const MAX_LENGTH = 2048;
// Parameters that only say where a visitor came from. Two links that differ in these are one campaign.
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$)/i;

/**
 * A campaign link in one canonical form, or `null` when it is not an https address. The form is
 * what the unique index compares: lower-case host without `www.`, no fragment, no credentials, no
 * tracking parameters, the remaining parameters sorted and no trailing slash.
 *
 * This is also the address that is stored, shown and opened: the one that was checked is the one
 * that is used, never the text as typed.
 */
export function normalizeCampaignUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!url.hostname || url.username || url.password) return null;

  url.hash = '';
  // A trailing dot names the same host (`catarse.me.`), so it must not make a second campaign.
  url.hostname = url.hostname
    .toLowerCase()
    .replace(/\.+$/, '')
    .replace(/^www\./, '');
  if (url.port === '443') url.port = '';
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);
  const path = url.pathname.replace(/\/+$/, '');
  return `https://${url.host}${path}${url.search}`;
}
