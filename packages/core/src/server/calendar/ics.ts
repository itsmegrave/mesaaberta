import { routes } from '../../routes';
// A table goes in, an iCalendar (RFC 5545) string comes out. The serializing is done by ical.js
// (Mozilla's iCalendar library: escaping, line folding at 75 octets, parameter quoting, value
// types) and the time zone rules by timezones-ical-library, which embeds them (it needs no
// filesystem, so it runs in a Worker). This file only decides *what* goes in an invite, and checks
// the few things that come from users or from the database before they get near the serializer.
import ICAL from 'ical.js';
import { tzlib_get_ical_block } from 'timezones-ical-library';
// The `.ts` extension lets `scripts/sample-invite.ts` run this module in plain Node.
import {
  RECURRENCE,
  instantToLocal,
  nextWeeklySession,
  weeklyInterval,
} from '../tables/schedule.ts';
import { toPlainText } from '../../text/rich.ts';

export type CalendarTable = {
  id: string;
  slug: string;
  title: string;
  description: string;
  extraInfo: string | null;
  kind: 'campaign' | 'one_shot' | 'adventure' | 'open';
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
  /** The rule the table form builds: `FREQ=WEEKLY`, optionally with `;INTERVAL=n`. Nothing else is accepted. */
  recurrence: string | null;
  until: Date | null;
  /** Raised on every edit, so a calendar replaces the event it already has. */
  icalSequence: number;
  /**
   * The table's sessions from its next one on (Gerenciar mesa → Sessões), when they are known:
   * a cancelled date leaves the series, a moved one is changed in it, one the GM added off the rule
   * joins it. Without them the event is the table's date and its rule alone.
   */
  sessions?: CalendarSession[];
};

/** One session of a table, as the calendar needs it. */
export type CalendarSession = {
  startsAt: Date;
  durationMinutes: number;
  status: 'scheduled' | 'cancelled';
  /** Where a moved session was first, on the table's rule. */
  movedFrom: Date | null;
};

export type InviteInput = {
  table: CalendarTable;
  /** `REQUEST` puts or updates the event; `CANCEL` removes it. */
  method: 'REQUEST' | 'CANCEL';
  /** The one recipient. Each player gets their own file, so nobody sees another's address. */
  attendee: { email: string; name?: string };
  /** Who the invite is from: a sender address of ours, never a player. */
  organizer: { email: string; name: string };
  /** The site's origin, for the link to the table (`https://example.org`). */
  baseUrl: string;
  /** The namespace of every event's UID (see `uidDomainFor`). */
  uidDomain: string;
  now?: Date;
};

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/**
 * The namespace of every calendar event's UID (`<table id>@<domain>`). A calendar app matches an
 * updated invite to the event it already has by this UID, so it must never change for a deployment
 * that has sent invites: set `CALENDAR_UID_DOMAIN` once and keep it through a change of address.
 * Without it, the host of `APP_ORIGIN` (or of `fallbackOrigin`) is used, and `localhost` last.
 */
export function uidDomainFor(
  env: { CALENDAR_UID_DOMAIN?: string; APP_ORIGIN?: string } | undefined,
  fallbackOrigin?: string,
): string {
  const configured = env?.CALENDAR_UID_DOMAIN?.trim();
  if (configured && HOSTNAME.test(configured)) return configured;
  for (const origin of [env?.APP_ORIGIN, fallbackOrigin]) {
    if (origin && URL.canParse(origin)) return new URL(origin).hostname;
  }
  return 'localhost';
}
const EMAIL = /^[^\s@<>",;:\\]+@[^\s@<>",;:\\]+\.[^\s@<>",;:\\]+$/;
// Control characters other than the line break.
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
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
  `${baseUrl.replace(/\/$/, '')}${routes.table(slug)}`;

/** Refuses an id or a recurrence that is not what this system produces. */
function checkTable(table: CalendarTable) {
  if (!/^[0-9a-f-]{8,64}$/i.test(table.id)) throw new Error('Invalid table id');
  if (table.recurrence !== null && !RECURRENCE.test(table.recurrence)) {
    throw new Error(`Unsupported recurrence: ${JSON.stringify(table.recurrence)}`);
  }
}

type Override = { recurrenceId: Date; startsAt: Date; durationMinutes: number };
type Series = { start: Date; exdates: Date[]; rdates: Date[]; overrides: Override[] };

/**
 * How the table's sessions change its series. The series starts on the rule's date of the next
 * session (where it was before a move); a cancelled date on the rule is left out (EXDATE), a date
 * the GM added off the rule is added (RDATE), and a session moved away from its date, or one that
 * runs longer or shorter than the table, is its own event in the series (RECURRENCE-ID). A date
 * the rule makes with no session written for it stays in: only what the GM did changes the series.
 */
function seriesOf(table: CalendarTable): Series {
  const scheduled = (table.sessions ?? [])
    .filter((session) => session.status === 'scheduled')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const interval = weeklyInterval(table.recurrence);
  const first = scheduled[0];
  const start =
    interval && first && first.startsAt.getTime() === table.startsAt.getTime() && first.movedFrom
      ? first.movedFrom
      : table.startsAt;

  const onRule = (date: Date) => {
    if (date.getTime() === start.getTime()) return true;
    if (!interval || date < start || (table.until && date > table.until)) return false;
    const next = nextWeeklySession(start, interval, table.timezone, new Date(date.getTime() - 1));
    return next.getTime() === date.getTime();
  };

  const series: Series = { start, exdates: [], rdates: [], overrides: [] };
  const seen = new Set<number>();
  for (const session of table.sessions ?? []) {
    if (session.startsAt < start && !(session.movedFrom && onRule(session.movedFrom))) continue;
    if (session.status === 'cancelled') {
      if (onRule(session.startsAt) && !seen.has(session.startsAt.getTime())) {
        seen.add(session.startsAt.getTime());
        series.exdates.push(session.startsAt);
      }
      continue;
    }
    const from = session.movedFrom && onRule(session.movedFrom) ? session.movedFrom : null;
    if (from) {
      series.overrides.push({ ...session, recurrenceId: from });
      continue;
    }
    if (!onRule(session.startsAt)) series.rdates.push(session.startsAt);
    if (session.durationMinutes !== table.durationMinutes)
      series.overrides.push({ ...session, recurrenceId: session.startsAt });
  }
  // A date both cancelled and taken again by a session is in the series.
  const taken = new Set(
    scheduled.filter((session) => !session.movedFrom).map((s) => s.startsAt.getTime()),
  );
  series.exdates = series.exdates.filter((date) => !taken.has(date.getTime()));
  return series;
}

/**
 * The events of one table: its series (one event for a one-shot, one recurring event for a
 * campaign), then one event for each session that differs from it.
 */
function tableEvents(
  table: CalendarTable,
  options: { baseUrl: string; uidDomain: string; now: Date; cancelled: boolean },
) {
  if (!table.sessions || options.cancelled) return [tableEvent(table, options)];
  const series = seriesOf(table);
  const master = tableEvent({ ...table, startsAt: series.start }, { ...options, series });
  const overrides = series.overrides.map((override) => {
    const event = tableEvent(
      {
        ...table,
        startsAt: override.startsAt,
        durationMinutes: override.durationMinutes,
        recurrence: null,
      },
      options,
    );
    event
      .addPropertyWithValue('recurrence-id', wallClock(override.recurrenceId, table.timezone))
      .setParameter('tzid', table.timezone);
    return event;
  });
  return [master, ...overrides];
}

/** The event for one table: one event for a one-shot, one recurring event for a campaign. */
function tableEvent(
  table: CalendarTable,
  {
    baseUrl,
    uidDomain,
    now,
    cancelled,
    series,
  }: { baseUrl: string; uidDomain: string; now: Date; cancelled: boolean; series?: Series },
) {
  const end = new Date(table.startsAt.getTime() + table.durationMinutes * 60_000);
  const url = tableUrl(baseUrl, table.slug);
  // Calendar apps show plain text, so the rich text is read as text first.
  const description = [toPlainText(table.description), toPlainText(table.extraInfo ?? ''), url]
    .filter(Boolean)
    .join('\n\n');

  const event = new ICAL.Component('vevent');
  if (!HOSTNAME.test(uidDomain)) throw new Error('Invalid calendar UID domain');
  event.updatePropertyWithValue('uid', `${table.id}@${uidDomain}`);
  event.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(now, true));
  event.updatePropertyWithValue('sequence', table.icalSequence);

  // The start and the end are the clock times in the table's zone, tagged with the zone's name.
  for (const [name, instant] of [
    ['dtstart', table.startsAt],
    ['dtend', end],
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
  for (const [name, dates] of [
    ['exdate', series?.exdates ?? []],
    ['rdate', series?.rdates ?? []],
  ] as const) {
    for (const date of dates) {
      event
        .addPropertyWithValue(name, wallClock(date, table.timezone))
        .setParameter('tzid', table.timezone);
    }
  }

  event.updatePropertyWithValue('summary', clean(table.title));
  event.updatePropertyWithValue('description', clean(description));
  event.updatePropertyWithValue('url', url);
  event.updatePropertyWithValue('status', cancelled ? 'CANCELLED' : 'CONFIRMED');
  event.updatePropertyWithValue('transp', 'OPAQUE');

  return event;
}

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
  uidDomain,
  now = new Date(),
}: InviteInput): string {
  if (!EMAIL.test(attendee.email)) throw new Error('Invalid attendee email address');
  if (!EMAIL.test(organizer.email)) throw new Error('Invalid organizer email address');
  checkTable(table);

  const vtimezone = timezoneComponent(table.timezone);
  const events = tableEvents(table, { baseUrl, uidDomain, now, cancelled: method === 'CANCEL' });

  for (const event of events) {
    event
      .addPropertyWithValue('organizer', `mailto:${organizer.email}`)
      .setParameter('cn', oneLine(organizer.name));

    const person = event.addPropertyWithValue('attendee', `mailto:${attendee.email}`);
    person.setParameter('cn', oneLine(attendee.name ?? '') || attendee.email);
    person.setParameter('role', 'REQ-PARTICIPANT');
    person.setParameter('partstat', 'NEEDS-ACTION');
    person.setParameter('rsvp', 'FALSE');
  }

  const calendar = new ICAL.Component(['vcalendar', [], []]);
  calendar.updatePropertyWithValue('version', '2.0');
  calendar.updatePropertyWithValue('prodid', '-//Mesa Aberta//mesaaberta.app//PT');
  calendar.updatePropertyWithValue('calscale', 'GREGORIAN');
  calendar.updatePropertyWithValue('method', method);
  calendar.addSubcomponent(vtimezone);
  for (const event of events) calendar.addSubcomponent(event);

  return `${calendar.toString()}\r\n`;
}

/**
 * Everything a person plays in or runs, as one calendar to download: an event per table, and the
 * rules of each time zone once. No attendees and no organizer, since it is the person's own file.
 */
export function buildCalendar({
  tables,
  baseUrl,
  uidDomain,
  now = new Date(),
}: {
  tables: CalendarTable[];
  baseUrl: string;
  uidDomain: string;
  now?: Date;
}): string {
  const calendar = new ICAL.Component(['vcalendar', [], []]);
  calendar.updatePropertyWithValue('version', '2.0');
  calendar.updatePropertyWithValue('prodid', '-//Mesa Aberta//mesaaberta.app//PT');
  calendar.updatePropertyWithValue('calscale', 'GREGORIAN');
  calendar.updatePropertyWithValue('x-wr-calname', 'Mesa Aberta');

  const zones = new Set<string>();
  for (const table of tables) {
    checkTable(table);
    if (!zones.has(table.timezone)) {
      zones.add(table.timezone);
      calendar.addSubcomponent(timezoneComponent(table.timezone));
    }
  }
  for (const table of tables) {
    for (const event of tableEvents(table, { baseUrl, uidDomain, now, cancelled: false }))
      calendar.addSubcomponent(event);
  }

  return `${calendar.toString()}\r\n`;
}
