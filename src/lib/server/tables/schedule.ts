export type Schedule = {
	kind: 'campaign' | 'one_shot';
	startsAt: Date;
	timezone: string;
	/** An iCalendar RRULE. Only `FREQ=WEEKLY` (with an optional `INTERVAL`) is understood. */
	recurrence: string | null;
	until: Date | null;
};

const DAY = 86_400_000;

/** The weeks between sessions, or null for a recurrence this does not understand. */
export function weeklyInterval(recurrence: string | null): number | null {
	if (!recurrence) return null;

	const rule = new Map(recurrence.split(';').map((part) => part.split('=') as [string, string]));
	if (rule.get('FREQ') !== 'WEEKLY') return null;

	const interval = Number(rule.get('INTERVAL') ?? 1);
	return Number.isInteger(interval) && interval >= 1 ? interval : null;
}

type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };

/** What the clocks in `timeZone` show at this instant. */
function wallClock(instant: Date, timeZone: string): Wall {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	}).formatToParts(instant);
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

	return {
		y: get('year'),
		m: get('month'),
		d: get('day'),
		h: get('hour'),
		mi: get('minute'),
		s: get('second')
	};
}

const asUtc = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);

/** The instant at which the clocks in `timeZone` show `wall`. */
function instantAt(wall: Wall, timeZone: string): Date {
	const target = asUtc(wall);
	let guess = target;

	// The zone's offset can differ between the guess and the answer, so correct it twice.
	for (let i = 0; i < 2; i++) guess += target - asUtc(wallClock(new Date(guess), timeZone));

	return new Date(guess);
}

/**
 * The start of the session at or after `now`, or null when there is none left: a one-shot that has
 * started, a campaign past its `until`, or one whose recurrence is not understood (which is then
 * treated as a single date rather than guessed at).
 *
 * A weekly session keeps its wall-clock time in the table's timezone, so it does not drift an hour
 * when the clocks change. The weekday is the one of `startsAt`; `BYDAY` is not read.
 */
export function nextOccurrence(schedule: Schedule, now: Date): Date | null {
	const { startsAt, timezone, until } = schedule;
	const interval = schedule.kind === 'campaign' ? weeklyInterval(schedule.recurrence) : null;

	if (interval === null) return startsAt >= now ? startsAt : null;

	const start = wallClock(startsAt, timezone);
	const occurrence = (n: number) =>
		n === 0
			? startsAt
			: instantAt(
					wallClock(
						new Date(
							Date.UTC(start.y, start.m - 1, start.d + 7 * interval * n, start.h, start.mi, start.s)
						),
						'UTC'
					),
					timezone
				);

	let n = Math.max(0, Math.floor((now.getTime() - startsAt.getTime()) / (7 * interval * DAY)) - 1);
	while (occurrence(n) < now) n++;

	const next = occurrence(n);
	return until && next > until ? null : next;
}

/** The instant at which the clocks in `timeZone` read `local` (`2026-10-10T19:00`). */
export function localToInstant(local: string, timeZone: string): Date {
	const [date, time] = local.split('T');
	const [y, m, d] = date.split('-').map(Number);
	const [h, mi] = time.split(':').map(Number);

	return instantAt({ y, m, d, h, mi, s: 0 }, timeZone);
}

const two = (n: number) => String(n).padStart(2, '0');

/** What the clocks in `timeZone` read at `instant`, as `2026-10-10T19:00`: the form's own format. */
export function instantToLocal(instant: Date, timeZone: string): string {
	const w = wallClock(instant, timeZone);
	return `${w.y}-${two(w.m)}-${two(w.d)}T${two(w.h)}:${two(w.mi)}`;
}

/** The zone's offset from UTC at `instant`, in minutes (São Paulo is -180). */
export function utcOffsetMinutes(instant: Date, timeZone: string): number {
	const whole = new Date(Math.floor(instant.getTime() / 1000) * 1000);
	return Math.round((asUtc(wallClock(whole, timeZone)) - whole.getTime()) / 60_000);
}
