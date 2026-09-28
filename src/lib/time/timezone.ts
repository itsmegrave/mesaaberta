/** Where most people on Mesa Aberta are: the zone a visitor sees before their own is known. */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** The cookie the browser sets with its own timezone, for visitors without one on their profile. */
export const TIMEZONE_COOKIE = 'tz';

/** True for an IANA zone the runtime knows (`America/Sao_Paulo`), false for anything else. */
export function isTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone === '' || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export type ViewerTimezone = {
  timezone: string;
  /** Where it came from: the profile, the browser's cookie, or the default. */
  source: 'profile' | 'browser' | 'default';
};

/**
 * The timezone to show times in: the one on the profile, else the browser's (from its cookie), else
 * the default. Resolved on the server, so the page renders the same times before and after hydration.
 */
export function viewerTimezone(
  profileTimezone: string | null | undefined,
  cookieTimezone: string | null | undefined,
): ViewerTimezone {
  if (isTimeZone(profileTimezone)) return { timezone: profileTimezone, source: 'profile' };
  if (isTimeZone(cookieTimezone)) return { timezone: cookieTimezone, source: 'browser' };
  return { timezone: DEFAULT_TIMEZONE, source: 'default' };
}

/** Every zone the runtime knows, for a picker: `America/Sao_Paulo` shown as `America/Sao Paulo`. */
export const timezoneOptions = () =>
  Intl.supportedValuesOf('timeZone').map((zone) => ({
    name: zone.replaceAll('_', ' '),
    slug: zone,
  }));
