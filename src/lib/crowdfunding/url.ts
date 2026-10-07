const MAX_LENGTH = 2048;
// Parameters that only say where a visitor came from. Two links that differ in these are one campaign.
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_|source$)/i;

/**
 * A campaign link in one canonical form, or `null` when it is not an https address. The form is
 * what the unique index compares: lower-case host without `www.`, no fragment, no credentials, no
 * tracking parameters, the remaining parameters sorted and no trailing slash.
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
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.port === '443') url.port = '';
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);
  const path = url.pathname.replace(/\/+$/, '');
  return `https://${url.host}${path}${url.search}`;
}
