import { m } from '$lib/paraglide/messages';
import { hostOf, PLATFORM_NAMES, type CrowdfundingPlatform } from './platforms';

/** The platform's name. The known ones are proper nouns; the rest is "Outra". */
export const platformLabel = (platform: CrowdfundingPlatform) =>
  platform === 'other' ? m.crowdfunding_platform_other() : PLATFORM_NAMES[platform];

/** The site a link leaves for, for a screen reader: the platform's name, or the host for another. */
export const siteName = (platform: CrowdfundingPlatform, url: string) =>
  platform === 'other' ? hostOf(url) : PLATFORM_NAMES[platform];
