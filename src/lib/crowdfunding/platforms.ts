/** The crowdfunding sites the list knows by name. Anything else is `other`. */
export const CROWDFUNDING_PLATFORMS = [
  'catarse',
  'kickstarter',
  'benfeitoria',
  'gamefound',
  'other',
] as const;
export type CrowdfundingPlatform = (typeof CROWDFUNDING_PLATFORMS)[number];

const HOSTS: Record<Exclude<CrowdfundingPlatform, 'other'>, string> = {
  catarse: 'catarse.me',
  kickstarter: 'kickstarter.com',
  benfeitoria: 'benfeitoria.com',
  gamefound: 'gamefound.com',
};

/** Proper nouns, so they are not translated. `other` is the one label the page words itself. */
export const PLATFORM_NAMES: Record<Exclude<CrowdfundingPlatform, 'other'>, string> = {
  catarse: 'Catarse',
  kickstarter: 'Kickstarter',
  benfeitoria: 'Benfeitoria',
  gamefound: 'Gamefound',
};

/** The platform a campaign link belongs to, read from its host (`www.` and subdomains included). */
export function platformOf(link: string): CrowdfundingPlatform {
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  for (const [platform, domain] of Object.entries(HOSTS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return platform as CrowdfundingPlatform;
  }
  return 'other';
}

/** The host a link points at, without `www.`, for the tile that has no image. */
export function hostOf(link: string): string {
  try {
    return new URL(link).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}
