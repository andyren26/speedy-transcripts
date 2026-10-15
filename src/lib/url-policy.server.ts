// Server-only half of the link policy: resolve the hostname and refuse anything that
// points at a non-public address (so a name like 10.0.0.1.nip.io or a DNS record
// pointing at the cloud metadata IP can't be used to reach our own network).

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, includes the cloud metadata service
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

function isBlockedAddress(address: string) {
  const family = isIP(address);
  if (family === 0) return true;
  // ::ffff:a.b.c.d is just an IPv4 address in disguise
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** True when `hostname` resolves only to public addresses (unresolvable names pass; the download itself will fail). */
export async function resolvesToPublicAddress(hostname: string) {
  try {
    const records = await lookup(hostname, { all: true });
    return records.every((r) => !isBlockedAddress(r.address));
  } catch {
    return true;
  }
}
