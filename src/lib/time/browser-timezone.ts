import { TIMEZONE_COOKIE, isTimeZone, type ViewerTimezone } from './timezone';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Tells the server the browser's timezone through a cookie, for someone without one on their
 * profile. Returns true when the page was rendered in another zone and should load again, so the
 * times on it are this person's. Once the cookie is there the server agrees, so it does not repeat.
 */
export function syncBrowserTimezone(
	viewer: ViewerTimezone,
	browserTimezone: string | undefined = Intl.DateTimeFormat().resolvedOptions().timeZone,
	doc: Pick<Document, 'cookie'> & { location: Pick<Location, 'protocol'> } = document
): boolean {
	if (viewer.source === 'profile' || !isTimeZone(browserTimezone)) return false;

	const secure = doc.location.protocol === 'https:' ? '; secure' : '';
	doc.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(browserTimezone)}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;

	return viewer.timezone !== browserTimezone;
}
