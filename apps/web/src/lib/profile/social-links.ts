// The links a person can put on their public profile. Shared by the form and the server: what
// the form lets through is what the server accepts.

/** The networks people ask for, plus a generic `website`. Add one here and it appears in the form. */
export const NETWORKS = [
  'instagram',
  'x',
  'bluesky',
  'facebook',
  'tiktok',
  'youtube',
  'twitch',
  'discord',
  'github',
  'linkedin',
  'website',
] as const;

export type Network = (typeof NETWORKS)[number];

export const MAX_SOCIAL_LINKS = 10;
export const MAX_SOCIAL_URL_LENGTH = 300;

export const isNetwork = (value: string): value is Network =>
  (NETWORKS as readonly string[]).includes(value);

/**
 * The address to store for something a person typed, or null if it is not an http(s) link.
 *
 * The value ends up in an `href` shown to other people, so a `javascript:` or `data:` address must
 * never get through, and neither may an address that carries a password. An address typed without
 * a scheme (`instagram.com/ana`, what people paste from a bar) is read as https.
 */
export function parseSocialUrl(raw: string): string | null {
  const typed = raw.trim();
  if (typed === '' || typed.startsWith('//')) return null;

  // Anything that has a scheme other than `scheme://` (javascript:, data:, mailto:) is refused.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed);
  if (hasScheme && !/^[a-z][a-z0-9+.-]*:\/\//i.test(typed)) return null;

  let url: URL;
  try {
    url = new URL(hasScheme ? typed : `https://${typed}`);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username !== '' || url.password !== '') return null;
  // A real host has a dot; this turns `https://a` and the like away.
  if (!url.hostname.includes('.')) return null;
  if (url.href.length > MAX_SOCIAL_URL_LENGTH) return null;

  return url.href;
}

// --- Handles --------------------------------------------------------------------------------------
// For a network the person types a handle (`@mesaaberta` or `mesaaberta`); the address is built here.
// Only `website` takes a full address. Discord has no address to open, so it is shown, not linked.

type Profile = { base: string | null; hosts: string[]; pattern: RegExp };

const PLAIN = /^[A-Za-z0-9._-]{1,50}$/;

const PROFILES: Record<Exclude<Network, 'website'>, Profile> = {
  instagram: {
    base: 'https://instagram.com/',
    hosts: ['instagram.com'],
    pattern: /^[A-Za-z0-9._]{1,30}$/,
  },
  x: { base: 'https://x.com/', hosts: ['x.com', 'twitter.com'], pattern: /^[A-Za-z0-9_]{1,15}$/ },
  bluesky: {
    base: 'https://bsky.app/profile/',
    hosts: ['bsky.app'],
    pattern: /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/,
  },
  facebook: { base: 'https://facebook.com/', hosts: ['facebook.com', 'fb.com'], pattern: PLAIN },
  tiktok: { base: 'https://tiktok.com/@', hosts: ['tiktok.com'], pattern: /^[A-Za-z0-9._]{1,30}$/ },
  youtube: { base: 'https://youtube.com/@', hosts: ['youtube.com'], pattern: PLAIN },
  twitch: { base: 'https://twitch.tv/', hosts: ['twitch.tv'], pattern: /^[A-Za-z0-9_]{1,25}$/ },
  discord: { base: null, hosts: [], pattern: /^[a-z0-9._]{2,32}$/ },
  github: { base: 'https://github.com/', hosts: ['github.com'], pattern: /^[A-Za-z0-9-]{1,39}$/ },
  linkedin: { base: 'https://linkedin.com/in/', hosts: ['linkedin.com'], pattern: PLAIN },
};

/** Whether the network is a handle one (everything but `website`). */
export const takesHandle = (network: Network): network is Exclude<Network, 'website'> =>
  network !== 'website';

/** The handle inside a profile address of this network (`instagram.com/ana` gives `ana`), or null. */
function handleInUrl(network: Exclude<Network, 'website'>, typed: string): string | null {
  const parsed = parseSocialUrl(typed);
  if (!parsed) return null;
  const url = new URL(parsed);
  const host = url.hostname.replace(/^(www|m|mobile)\./, '');
  if (!PROFILES[network].hosts.includes(host)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (network === 'linkedin' || network === 'bluesky') {
    if (parts[0] !== (network === 'linkedin' ? 'in' : 'profile')) return null;
    return parts[1] ?? null;
  }
  return parts[0]?.replace(/^@/, '') ?? null;
}

/**
 * The handle to store for what someone typed for a network: `@ana`, `ana`, or an address of the
 * network's own site, all give `ana`. Null if it is not a valid handle there. Discord is kept
 * lower case, as it is on Discord.
 */
export function parseHandle(network: Exclude<Network, 'website'>, raw: string): string | null {
  const typed = raw.trim();
  if (typed === '') return null;

  const looksLikeAddress = /[/:]/.test(typed) || /^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(typed);
  const candidate =
    (looksLikeAddress ? handleInUrl(network, typed) : typed.replace(/^@/, '')) ?? '';
  const handle = network === 'discord' ? candidate.toLowerCase() : candidate;

  return PROFILES[network].pattern.test(handle) ? handle : null;
}

/** The address a handle opens, or null where there is none (Discord). */
export function handleUrl(network: Exclude<Network, 'website'>, handle: string): string | null {
  const { base } = PROFILES[network];
  return base ? `${base}${handle}` : null;
}

/** The handle with its `@`, the way it is shown (`@ana`). */
export const handleLabel = (handle: string) => `@${handle}`;

/** What a stored link is on a profile: the text next to the icon and where it opens, if anywhere. */
export type SocialTarget = { text: string; href: string | null };

/** What to put back in the form for a stored link: the handle, or the address of a website. */
export function typedValue(link: {
  network: Network;
  handle: string | null;
  url: string | null;
}): string {
  if (!takesHandle(link.network)) return link.url ?? '';
  const legacy = link.url ? handleInUrl(link.network, link.url) : null;
  return link.handle ?? legacy ?? link.url ?? '';
}

/**
 * The target of a stored link. A link saved before handles existed has only an address: the handle
 * is read from it when it is one of the network's own, otherwise the address is shown as it is.
 */
export function socialTarget(link: {
  network: Network;
  handle: string | null;
  url: string | null;
}): SocialTarget | null {
  const { network } = link;
  if (!takesHandle(network)) {
    const href = link.url ? parseSocialUrl(link.url) : null;
    return href ? { text: new URL(href).hostname.replace(/^www\./, ''), href } : null;
  }

  const handle = link.handle ?? (link.url ? handleInUrl(network, link.url) : null);
  if (handle && PROFILES[network].pattern.test(handle)) {
    return { text: handleLabel(handle), href: handleUrl(network, handle) };
  }
  const href = link.url ? parseSocialUrl(link.url) : null;
  return href ? { text: new URL(href).hostname.replace(/^www\./, ''), href } : null;
}
