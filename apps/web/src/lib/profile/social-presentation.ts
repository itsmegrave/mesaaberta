import type { IconName } from '$lib/icons/names';
import { m } from '$lib/paraglide/messages';
import type { Network } from './social-links';

export const networkLabels: Record<Network, () => string> = {
  instagram: m.network_instagram,
  x: m.network_x,
  bluesky: m.network_bluesky,
  facebook: m.network_facebook,
  tiktok: m.network_tiktok,
  youtube: m.network_youtube,
  twitch: m.network_twitch,
  discord: m.network_discord,
  github: m.network_github,
  linkedin: m.network_linkedin,
  website: m.network_website,
};
export const networkIcons: Record<Network, IconName> = {
  instagram: 'brand:instagram',
  x: 'brand:x',
  bluesky: 'brand:bluesky',
  facebook: 'brand:facebook',
  tiktok: 'brand:tiktok',
  youtube: 'brand:youtube',
  twitch: 'brand:twitch',
  discord: 'brand:discord',
  github: 'brand:github',
  linkedin: 'brand:linkedin',
  website: 'globe',
};
