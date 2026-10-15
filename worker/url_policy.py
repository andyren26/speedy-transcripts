"""
Which links the worker is willing to download.

Rules (kept in sync with src/lib/url-policy.ts, which rejects the same links at the
web API before a job is even created; this is the second, independent check):
  * http(s) only, standard ports (80/443), no user:password@ in the URL
  * no YouTube (its own domains, and any redirect that lands on one)
  * no IP-address links, no localhost / internal names, and no hostname that
    RESOLVES to a private, loopback, link-local (169.254.x.x, the cloud metadata
    range) or otherwise non-public address
Redirects are followed by hand so every hop is checked; yt-dlp is then given the
final URL. (Residual risk: DNS can change between our check and yt-dlp's own
lookup, "DNS rebinding". The extractor restriction in worker.py and the task's
minimal IAM role are the other layers.)
"""
import ipaddress
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

YOUTUBE_DOMAINS = (
    "youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "youtubekids.com",
    "youtubeeducation.com",
    "yt.be",
    "googlevideo.com",
)
INTERNAL_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet")
ALLOWED_PORTS = (None, 80, 443)
MAX_REDIRECTS = 5


class UrlBlocked(Exception):
    """The link is not allowed. `code` is 'youtube', 'private' or 'invalid'."""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code}: {detail}")
        self.code = code
        self.detail = detail


def is_youtube_host(host: str) -> bool:
    host = host.lower().rstrip(".")
    return any(host == d or host.endswith("." + d) for d in YOUTUBE_DOMAINS)


def _is_public_ip(ip: "ipaddress._BaseAddress") -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def check_host(host: str) -> None:
    """Raise UrlBlocked unless `host` is a public, non-YouTube internet hostname."""
    host = (host or "").lower().rstrip(".")
    if not host:
        raise UrlBlocked("invalid", "no host")
    if is_youtube_host(host):
        raise UrlBlocked("youtube", host)
    try:
        ipaddress.ip_address(host.strip("[]"))
        raise UrlBlocked("private", "IP address link")
    except ValueError:
        pass  # not an IP literal: a normal hostname
    if "." not in host or host == "localhost" or host.endswith(INTERNAL_SUFFIXES):
        raise UrlBlocked("private", host)
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return  # can't resolve: yt-dlp will fail on its own with a normal error
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not _is_public_ip(ip):
            raise UrlBlocked("private", f"{host} -> non-public address")


def check_url(url: str) -> urllib.parse.ParseResult:
    try:
        parts = urllib.parse.urlparse(url.strip())
        port = parts.port
    except ValueError:
        raise UrlBlocked("invalid", "unparseable URL")
    if parts.scheme not in ("http", "https"):
        raise UrlBlocked("invalid", "scheme")
    if parts.username or parts.password:
        raise UrlBlocked("invalid", "credentials in URL")
    if port not in ALLOWED_PORTS:
        raise UrlBlocked("invalid", f"port {port}")
    check_host(parts.hostname or "")
    return parts


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - urllib hook
        return None  # surface 3xx as HTTPError so we can inspect each hop


def resolve_safe_url(url: str, timeout: float = 10.0) -> str:
    """Validate `url`, follow its redirects hop by hop validating each one, and return
    the final URL. Raises UrlBlocked on any violation. Network errors (timeouts, 404,
    servers that reject our probe) are NOT policy violations: we return the last
    validated URL and let yt-dlp report the real problem."""
    opener = urllib.request.build_opener(_NoRedirect)
    current = url.strip()
    for _ in range(MAX_REDIRECTS + 1):
        check_url(current)
        req = urllib.request.Request(
            current,
            headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-0"},
            method="GET",
        )
        try:
            resp = opener.open(req, timeout=timeout)
            resp.close()  # headers only; never read the body
            return current
        except urllib.error.HTTPError as e:
            location: Optional[str] = e.headers.get("Location") if e.headers else None
            e.close()
            if e.code in (301, 302, 303, 307, 308) and location:
                current = urllib.parse.urljoin(current, location)
                continue
            return current  # 4xx/5xx: not a redirect; yt-dlp will report it
        except (urllib.error.URLError, OSError, ValueError):
            return current
    raise UrlBlocked("invalid", "too many redirects")
