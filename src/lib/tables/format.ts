/**
 * A session start as people say it, in the table's own timezone (the one its GM set), with the
 * zone named so a player elsewhere can convert. Pass the timezone explicitly: without it the
 * server and the browser would each use their own and the page would change on hydration.
 */
export function formatSession(date: Date, timeZone: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		timeZone,
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		timeZoneName: 'shortOffset'
	}).format(date);
}

/** `240` is `4 h`, `150` is `2 h 30 min`, `45` is `45 min`. */
export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;

	return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(' ');
}

/** How long to wait, rounded up to the minute so it never promises a moment too early: `90` is `2 min`. */
export function formatWait(seconds: number): string {
	return formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}
