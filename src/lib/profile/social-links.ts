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
	'website'
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
