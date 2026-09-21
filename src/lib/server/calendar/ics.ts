// A table goes in, an iCalendar (RFC 5545) string comes out. The serializing is done by ical.js
// (Mozilla's iCalendar library: escaping, line folding at 75 octets, parameter quoting, value
// types) and the time zone rules by timezones-ical-library, which embeds them (it needs no
// filesystem, so it runs in a Worker). This file only decides *what* goes in an invite, and checks
// the few things that come from users or from the database before they get near the serializer.
import ICAL from 'ical.js';
import { tzlib_get_ical_block } from 'timezones-ical-library';
// The `.ts` extension lets `scripts/sample-invite.ts` run this module in plain Node.
import { instantToLocal } from '../tables/schedule.ts';

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
// Control characters other than the line break.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Text as one or more lines separated by `\n`. ical.js escapes `\n` but leaves a `\r` as it is, and a
 * bare CR ends a line for a lenient parser, so every line break is turned into a plain `\n` first
 * (a test proves a title cannot then add an attendee or an event).
 */
const clean = (value: string) => value.replace(/\r\n|\r/g, '\n').replace(CONTROL, '');
/** A parameter value (a name): no line breaks at all, since a parameter cannot span lines. */
const oneLine = (value: string) =>
	clean(value)
		.replace(/[\r\n]+/g, ' ')
		.trim();

/** `2026-10-10T19:00` (what the clocks read in the zone) as the fields of a floating time. */
function wallClock(instant: Date, timeZone: string) {
	const [date, time] = instantToLocal(instant, timeZone).split('T');
	const [year, month, day] = date.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);

	return ICAL.Time.fromData({ year, month, day, hour, minute, second: 0 });
}

/** The zone's real rules (with their yearly recurrence), or an error for a zone the library does not know. */
function timezoneComponent(tzid: string): InstanceType<typeof ICAL.Component> {
	const block = tzlib_get_ical_block(tzid);
	if (!Array.isArray(block)) throw new Error(`Unknown timezone: ${JSON.stringify(tzid)}`);

	return new ICAL.Component(ICAL.parse(block[0]));
}

/** The public page of a table, which the invite and its e-mail both link to. */
export const tableUrl = (baseUrl: string, slug: string) =>
	`${baseUrl.replace(/\/$/, '')}/tables/${encodeURIComponent(slug)}`;

/**
 * One `.ics` for one recipient. A one-shot is a single event; a campaign is one recurring event
 * with a stable UID, so an edit (a higher SEQUENCE) replaces it. Throws on an address, a UID, a
 * timezone or a recurrence that is not what this system produces, rather than writing it out.
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

	const vtimezone = timezoneComponent(table.timezone);
	const end = new Date(table.startsAt.getTime() + table.durationMinutes * 60_000);
	const url = tableUrl(baseUrl, table.slug);
	const description = [table.description, table.extraInfo, url].filter(Boolean).join('\n\n');

	const event = new ICAL.Component('vevent');
	event.updatePropertyWithValue('uid', `${table.id}@${UID_DOMAIN}`);
	event.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(now, true));
	event.updatePropertyWithValue('sequence', table.icalSequence);

	// The start and the end are the clock times in the table's zone, tagged with the zone's name.
	for (const [name, instant] of [
		['dtstart', table.startsAt],
		['dtend', end]
	] as const) {
		event
			.addPropertyWithValue(name, wallClock(instant, table.timezone))
			.setParameter('tzid', table.timezone);
	}

	if (table.recurrence) {
		const rule = ICAL.Recur.fromString(table.recurrence);
		// With a zoned start, the standard wants the end date as a UTC instant.
		if (table.until) rule.until = ICAL.Time.fromJSDate(table.until, true);
		event.updatePropertyWithValue('rrule', rule);
	}

	event.updatePropertyWithValue('summary', clean(table.title));
	event.updatePropertyWithValue('description', clean(description));
	event.updatePropertyWithValue('url', url);
	event.updatePropertyWithValue('status', method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED');
	event.updatePropertyWithValue('transp', 'OPAQUE');

	event
		.addPropertyWithValue('organizer', `mailto:${organizer.email}`)
		.setParameter('cn', oneLine(organizer.name));

	const person = event.addPropertyWithValue('attendee', `mailto:${attendee.email}`);
	person.setParameter('cn', oneLine(attendee.name ?? '') || attendee.email);
	person.setParameter('role', 'REQ-PARTICIPANT');
	person.setParameter('partstat', 'NEEDS-ACTION');
	person.setParameter('rsvp', 'FALSE');

	const calendar = new ICAL.Component(['vcalendar', [], []]);
	calendar.updatePropertyWithValue('version', '2.0');
	calendar.updatePropertyWithValue('prodid', '-//Mesa Aberta//mesaaberta.app//PT');
	calendar.updatePropertyWithValue('calscale', 'GREGORIAN');
	calendar.updatePropertyWithValue('method', method);
	calendar.addSubcomponent(vtimezone);
	calendar.addSubcomponent(event);

	return `${calendar.toString()}\r\n`;
}
