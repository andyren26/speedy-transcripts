// Which links a user may submit for transcription. Pure string checks, so the upload
// form (browser) and POST /api/jobs (server) apply the exact same rules; the server
// adds a DNS check on top (url-policy.server.ts) and the worker re-checks everything
// (worker/url_policy.py), including every redirect.

export const YOUTUBE_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "youtubekids.com",
  "youtubeeducation.com",
  "yt.be",
  "googlevideo.com",
];

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; code: "youtube" | "private" | "invalid"; message: string };

export const URL_MESSAGES = {
  youtube: "目前不支援 YouTube 網址，請改用上傳檔案，或貼上其他公開的直接下載連結。",
  private: "這個網址無法使用（不支援 IP 位址或內部網路位址），請改用上傳檔案或公開的直接下載連結。",
  invalid: "請貼上以 http:// 或 https:// 開頭的有效網址。",
} as const;

export function isYouTubeHost(host: string) {
  const h = host.toLowerCase().replace(/\.$/, "");
  return YOUTUBE_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** True for IPv4 / IPv6 literals. (new URL() already turns 2130706433 or 0x7f.1 into 127.0.0.1.) */
export function isIpLiteral(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
}

export function checkVideoUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, code: "invalid", message: URL_MESSAGES.invalid };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "invalid", message: URL_MESSAGES.invalid };
  }
  if (url.username || url.password) {
    return { ok: false, code: "invalid", message: URL_MESSAGES.invalid };
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, code: "invalid", message: URL_MESSAGES.invalid };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isYouTubeHost(host)) {
    return { ok: false, code: "youtube", message: URL_MESSAGES.youtube };
  }
  if (
    !host ||
    isIpLiteral(host) ||
    !host.includes(".") ||
    host === "localhost" ||
    INTERNAL_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return { ok: false, code: "private", message: URL_MESSAGES.private };
  }
  return { ok: true, url };
}
