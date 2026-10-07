/**
 * Whether an IP address may be fetched from the server. Anything that is not a public unicast
 * address (private, loopback, link-local, carrier-grade NAT, multicast, reserved, documentation
 * ranges) is refused, so a campaign link cannot make the Worker read our own network or a metadata
 * endpoint. Unparseable input is refused too.
 */
export function isPublicAddress(address: string): boolean {
  const ip = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (ip.includes(':')) return isPublicV6(ip);
  return isPublicV4(ip);
}

function parseV4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPublicV4(ip: string): boolean {
  const octets = parseV4(ip);
  if (!octets) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol, TEST-NET-1
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  return a < 224; // multicast and reserved
}

/** Expands an IPv6 address to its eight 16-bit groups, or null when it is not one. */
function groupsOfV6(ip: string): number[] | null {
  let text = ip.split('%')[0];
  // A dotted tail (::ffff:1.2.3.4) is two groups.
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const octets = parseV4(tail[1]);
    if (!octets) return null;
    const hex = (high: number, low: number) => ((high << 8) | low).toString(16);
    text = `${text.slice(0, -tail[1].length)}${hex(octets[0], octets[1])}:${hex(octets[2], octets[3])}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const side = (part: string) => (part === '' ? [] : part.split(':'));
  const head = side(halves[0]);
  const rest = halves.length === 2 ? side(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (all.length !== 8) return null;
  const groups = all.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return groups.every((group) => !Number.isNaN(group)) ? groups : null;
}

function isPublicV6(ip: string): boolean {
  const g = groupsOfV6(ip);
  if (!g) return false;
  // An IPv4 address carried inside IPv6 is judged as that IPv4 address.
  const embedded = (high: number, low: number) =>
    `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  const first5Zero = g.slice(0, 5).every((group) => group === 0);
  if (first5Zero && g[5] === 0xffff) return isPublicV4(embedded(g[6], g[7])); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPublicV4(embedded(g[6], g[7])); // NAT64
  if (g.every((group) => group === 0)) return false; // ::
  if (g.slice(0, 7).every((group) => group === 0) && g[7] === 1) return false; // ::1
  if (first5Zero) return false; // ::a.b.c.d, deprecated IPv4-compatible
  if ((g[0] & 0xfe00) === 0xfc00) return false; // unique local
  if ((g[0] & 0xffc0) === 0xfe80) return false; // link-local
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2002) return isPublicV4(embedded(g[1], g[2])); // 6to4
  return (g[0] & 0xe000) === 0x2000; // only global unicast 2000::/3
}
