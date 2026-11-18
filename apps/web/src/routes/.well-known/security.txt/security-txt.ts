// RFC 9116 asks for an Expires under a year away. Computing it per request keeps the file valid
// without anyone having to remember to renew it.
const VALID_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export function securityTxt(origin: string, contact: string, now = Date.now()): string {
  const expires = new Date(Math.floor(now / DAY_MS) * DAY_MS + VALID_DAYS * DAY_MS);
  return [
    `Contact: mailto:${contact}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: pt, en',
    `Canonical: ${origin}/.well-known/security.txt`,
    '',
  ].join('\n');
}
