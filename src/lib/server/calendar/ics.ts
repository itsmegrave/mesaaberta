// A pure module: a table goes in, an iCalendar (RFC 5545) string comes out. No I/O, no clock unless
// `now` is passed. Everything that ends up in the output is escaped or checked here, because the
// text comes from users and a calendar file is parsed line by line: a newline that got through
// would let a title add an attendee or an event.
// The `.ts` extension lets `scripts/sample-invite.ts` run this module in plain Node.
import { instantToLocal, utcOffsetMinutes } from '../tables/schedule.ts';

export type CalendarTable = {
	id: string;
	slug: string;
	title: string;
	description: string;
	extraInfo: string | null;
	kind: 'campaign' | 'one_shot';
	startsAt: Date;
	durationMinutes: number;
	timezone: string;
	/** The rule the table form builds: `FREQ=WEEKLY`, optionally with `;INTERVAL=n`. Nothing else is accepted. */
	recurrence: string | null;
	until: Date | null;
	/** Raised on every edit, so a calendar replaces the event it already has. */
	icalSequence: number;
};

export type InviteInput = {
	table: CalendarTable;
	/** `REQUEST` puts or updates the event; `CANCEL` removes it. */
	method: 'REQUEST' | 'CANCEL';
	/** The one recipient. Each player gets their own file, so nobody sees another's address. */
	attendee: { email: string; name?: string };
	/** Who the invite is from: a sender address of ours, never a player. */
	organizer: { email: string; name: string };
	/** The site's origin, for the link to the table (`https://mesaaberta.app`). */
	baseUrl: string;
	now?: Date;
};

const UID_DOMAIN = 'mesaaberta.app';
const EMAIL = /^[^\s@<>",;:\\]+@[^\s@<>",;:\\]+\.[^\s@<>",;:\\]+$/;
const RECURRENCE = /^FREQ=WEEKLY(;INTERVAL=[1-9]\d?)?$/;
// Control characters other than the line break, which text handles.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Text values (RFC 5545 3.3.11): line breaks become `\n`, and `\`, `;` and `,` are escaped. */
function text(value: string): string {
	return value
		.replace(/\r\n|\r/g, '\n')
		.replace(CONTROL, '')
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

/** A parameter value (a `CN`): quoted, with anything that could end the quote or the line removed. */
const param = (value: string) =>
	`"${value
		.replace(/[\r\n"]/g, ' ')
		.replace(CONTROL, '')
		.trim()}"`;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

const utcStamp = (date: Date) =>
	`${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/** `2026-10-10T19:00` (what the clocks read in the zone) as `20261010T190000`. */
const zoned = (instant: Date, timeZone: string) =>
	`${instantToLocal(instant, timeZone).replace(/[-:]/g, '')}00`;

const offset = (minutes: number) =>
	`${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}${pad(Math.abs(minutes) % 60)}`;

/** Lines are at most 75 octets, folded with a CRLF and a space, never inside a multi-byte character. */
function fold(line: string): string {
	const encoder = new TextEncoder();
	const out: string[] = [];
	let current = '';
	let size = 0;

	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = out.length === 0 ? 75 : 74; // a continuation line starts with a space
		if (size + bytes > limit) {
			out.push(current);
			current = '';
			size = 0;
		}
		current += char;
		size += bytes;
	}
	out.push(current);

	return out.join('\r\n ');
}

/**
 * The zone's offsets as a VTIMEZONE, so a client that does not know the zone name still gets the
 * right times. It lists the changes for the first three years from the first session (a zone with
 * none, like São Paulo since 2019, gets a single STANDARD block); a recurring event that runs
 * longer than that leans on the client knowing the zone by name.
 */
function timezone(tzid: string, firstSession: Date): string[] {
	const from = Date.UTC(firstSession.getUTCFullYear(), 0, 1);
	const to = Date.UTC(firstSession.getUTCFullYear() + 3, 0, 1);
	const DAY = 86_400_000;

	const name = (at: Date) =>
		new Intl.DateTimeFormat('en-US', { timeZone: tzid, timeZoneName: 'shortOffset' })
			.formatToParts(at)
			.find((part) => part.type === 'timeZoneName')?.value ?? tzid;
	const wall = (ms: number) => utcStamp(new Date(ms)).replace('Z', '');

	const blocks: string[][] = [];
	for (let day = from; day < to; day += DAY) {
		const before = utcOffsetMinutes(new Date(day), tzid);
		if (before === utcOffsetMinutes(new Date(day + DAY), tzid)) continue;

		// The change is somewhere in this day: find the minute.
		let low = day;
		let high = day + DAY;
		while (high - low > 60_000) {
			const mid = low + Math.floor((high - low) / 120_000) * 60_000;
			if (utcOffsetMinutes(new Date(mid), tzid) === before) low = mid;
			else high = mid;
		}
		const after = utcOffsetMinutes(new Date(high), tzid);

		blocks.push([
			after > before ? 'BEGIN:DAYLIGHT' : 'BEGIN:STANDARD',
			`DTSTART:${wall(high + before * 60_000)}`,
			`TZOFFSETFROM:${offset(before)}`,
			`TZOFFSETTO:${offset(after)}`,
			`TZNAME:${name(new Date(high))}`,
			after > before ? 'END:DAYLIGHT' : 'END:STANDARD'
		]);
	}

	if (blocks.length === 0) {
		const fixed = utcOffsetMinutes(firstSession, tzid);
		blocks.push([
			'BEGIN:STANDARD',
			'DTSTART:19700101T000000',
			`TZOFFSETFROM:${offset(fixed)}`,
			`TZOFFSETTO:${offset(fixed)}`,
			`TZNAME:${name(firstSession)}`,
			'END:STANDARD'
		]);
	}

	return ['BEGIN:VTIMEZONE', `TZID:${tzid}`, ...blocks.flat(), 'END:VTIMEZONE'];
}

/**
 * One `.ics` for one recipient. A one-shot is a single event; a campaign is one recurring event
 * with a stable UID, so an edit (a higher SEQUENCE) replaces it. Throws on an address, a UID or a
 * recurrence that is not what this system produces, rather than writing it out.
 */
export function buildInvite({
	table,
	method,
	attendee,
	organizer,
	baseUrl,
	now = new Date()
}: InviteInput): string {
	if (!EMAIL.test(attendee.email)) throw new Error('Invalid attendee email address');
	if (!EMAIL.test(organizer.email)) throw new Error('Invalid organizer email address');
	if (!/^[0-9a-f-]{8,64}$/i.test(table.id)) throw new Error('Invalid table id');
	if (table.recurrence !== null && !RECURRENCE.test(table.recurrence)) {
		throw new Error(`Unsupported recurrence: ${JSON.stringify(table.recurrence)}`);
	}

	const end = new Date(table.startsAt.getTime() + table.durationMinutes * 60_000);
	const rule =
		table.recurrence &&
		`${table.recurrence}${table.until ? `;UNTIL=${utcStamp(table.until)}` : ''}`;
	const url = `${baseUrl.replace(/\/$/, '')}/tables/${encodeURIComponent(table.slug)}`;
	const description = [table.description, table.extraInfo, url].filter(Boolean).join('\n\n');

	const attendeeLine = `ATTENDEE;CN=${param(attendee.name?.trim() || attendee.email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${attendee.email}`;

	const event = [
		'BEGIN:VEVENT',
		`UID:${table.id}@${UID_DOMAIN}`,
		`DTSTAMP:${utcStamp(now)}`,
		`SEQUENCE:${table.icalSequence}`,
		`DTSTART;TZID=${table.timezone}:${zoned(table.startsAt, table.timezone)}`,
		`DTEND;TZID=${table.timezone}:${zoned(end, table.timezone)}`,
		...(rule ? [`RRULE:${rule}`] : []),
		`SUMMARY:${text(table.title)}`,
		`DESCRIPTION:${text(description)}`,
		`URL:${url}`,
		`STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
		'TRANSP:OPAQUE',
		`ORGANIZER;CN=${param(organizer.name)}:mailto:${organizer.email}`,
		attendeeLine,
		'END:VEVENT'
	];

	return (
		[
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Mesa Aberta//mesaaberta.app//PT',
			'CALSCALE:GREGORIAN',
			`METHOD:${method}`,
			...timezone(table.timezone, table.startsAt),
			...event,
			'END:VCALENDAR'
		]
			.map(fold)
			.join('\r\n') + '\r\n'
	);
}
