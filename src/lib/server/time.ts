import type { Cookies } from '@sveltejs/kit';
import { TIMEZONE_COOKIE, viewerTimezone } from '$lib/time/timezone';

/**
 * The zone this person works in: their profile's, else their browser's, else the default. A GM
 * types a table's time in it, and the table keeps it so a weekly session stays at the same local
 * hour for them across daylight-saving changes.
 */
export async function timezoneOf(locals: App.Locals, cookies: Pick<Cookies, 'get'>) {
	const profile = await locals.getProfile();
	return viewerTimezone(profile?.timezone, cookies.get(TIMEZONE_COOKIE)).timezone;
}
