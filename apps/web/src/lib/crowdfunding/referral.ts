import { platformOf } from './platforms';
import { normalizeCampaignUrl } from './url';

/** Click-time attribution only; stored campaign URLs remain canonical for deduplication. */
export function campaignReferralUrl(raw: string): string | undefined {
  if (!normalizeCampaignUrl(raw)) return undefined;
  const platform = platformOf(raw);
  if (platform !== 'catarse' && platform !== 'meeplestarter') return raw;

  const url = new URL(raw);
  // A new referral must not inherit an earlier sharer's campaign or content tags.
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || (platform === 'catarse' && /^ref$/i.test(key))) {
      url.searchParams.delete(key);
    }
  }
  // Catarse reports its native ref alongside UTMs; Meeplestarter uses Google Analytics UTMs.
  if (platform === 'catarse') url.searchParams.set('ref', 'mesaaberta');
  url.searchParams.set('utm_source', 'mesaaberta');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'crowdfunding');
  return url.href;
}
