import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { buildInvite, type CalendarTable } from './ics';

const table: CalendarTable = {
	id: '3f1c2d4e-1111-4222-8333-444455556666',
	slug: 'mesa-do-dragao',
	title: 'Mesa do Dragão',
	description: 'Uma noite só.',
	extraInfo: null,
	kind: 'one_shot',
	startsAt: new Date('2026-10-10T22:00:00Z'), // 19:00 in São Paulo
	durationMinutes: 240,
	timezone: 'America/Sao_Paulo',
	recurrence: null,
	until: null,
	icalSequence: 0
};

const base = {
	organizer: { email: 'convites@mesaaberta.app', name: 'Mesa Aberta' },
	baseUrl: 'https://mesaaberta.app',
	now: new Date('2026-10-01T12:00:00Z')
};

const invite = (over: Partial<Parameters<typeof buildInvite>[0]> = {}) =>
	buildInvite({
		table,
		method: 'REQUEST',
		attendee: { email: 'ana@example.com', name: 'Ana' },
		...base,
		...over
	});

/** The content lines, after undoing the folding (a CRLF then a space continues the previous line). */
const lines = (ics: string) =>
	ics
		.replace(/\r\n[ \t]/g, '')
		.split('\r\n')
		.filter(Boolean);
const named = (ics: string, name: string) =>
	lines(ics).filter((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));
const unescape = (text: string) => text.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const byteLength = (s: string) => new TextEncoder().encode(s).length;

describe('a REQUEST for a one-shot', () => {
	const ics = invite();

	it('is a calendar with one event, ending in CRLF', () => {
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(named(ics, 'BEGIN').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
		expect(ics).not.toMatch(/[^\r]\n/); // every newline is a CRLF
	});

	it('says which method and what it is', () => {
		expect(lines(ics)).toEqual(
			expect.arrayContaining([
				'VERSION:2.0',
				'METHOD:REQUEST',
				'STATUS:CONFIRMED',
				'SUMMARY:Mesa do Dragão',
				`UID:${table.id}@mesaaberta.app`,
				'SEQUENCE:0',
				'DTSTAMP:20261001T120000Z'
			])
		);
	});

	it("starts and ends in the table's timezone, as the wall clock there", () => {
		expect(lines(ics)).toEqual(
			expect.arrayContaining([
				'DTSTART;TZID=America/Sao_Paulo:20261010T190000',
				'DTEND;TZID=America/Sao_Paulo:20261010T230000'
			])
		);
	});

	it('does not repeat', () => {
		expect(named(ics, 'RRULE')).toHaveLength(0);
	});

	it('links to the table page', () => {
		expect(named(ics, 'URL')).toEqual(['URL:https://mesaaberta.app/tables/mesa-do-dragao']);
	});

	it('describes the timezone, so a client that does not know the name still gets the offset', () => {
		expect(lines(ics)).toEqual(
			expect.arrayContaining(['BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'END:VTIMEZONE'])
		);
		expect(named(ics, 'TZOFFSETTO')).toEqual(['TZOFFSETTO:-0300']);
	});
});

describe('a campaign', () => {
	const campaign = { ...table, kind: 'campaign' as const, recurrence: 'FREQ=WEEKLY' };

	it('is one recurring event, not one per session', () => {
		const ics = invite({ table: campaign });

		expect(named(ics, 'RRULE')).toEqual(['RRULE:FREQ=WEEKLY']);
		expect(named(ics, 'UID')).toHaveLength(1);
	});

	it('keeps INTERVAL for a biweekly one', () => {
		expect(
			named(invite({ table: { ...campaign, recurrence: 'FREQ=WEEKLY;INTERVAL=2' } }), 'RRULE')
		).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=2']);
	});

	it('ends on the last day, as a UTC instant (which is what a rule with a zoned start requires)', () => {
		const until = new Date('2026-12-02T02:59:00Z');

		expect(named(invite({ table: { ...campaign, until } }), 'RRULE')).toEqual([
			'RRULE:FREQ=WEEKLY;UNTIL=20261202T025900Z'
		]);
	});

	it('keeps 20:00 New York as 20:00 across the daylight-saving change, and describes both offsets', () => {
		const ny = {
			...campaign,
			startsAt: new Date('2026-03-03T01:00:00Z'),
			timezone: 'America/New_York'
		};
		const ics = invite({ table: ny });

		expect(lines(ics).filter((l) => l.startsWith('DTSTART;TZID='))).toEqual([
			'DTSTART;TZID=America/New_York:20260302T200000'
		]);
		// The zone's own change, at 02:00 local on 8 March 2026.
		expect(lines(ics)).toContain('DTSTART:20260308T020000');
		expect(lines(ics)).toEqual(expect.arrayContaining(['BEGIN:DAYLIGHT', 'BEGIN:STANDARD']));
		expect(named(ics, 'TZOFFSETTO')).toEqual(
			expect.arrayContaining(['TZOFFSETTO:-0400', 'TZOFFSETTO:-0500'])
		);
	});

	it.each([
		'FREQ=DAILY',
		'FREQ=WEEKLY;COUNT=99',
		'FREQ=WEEKLY\r\nATTENDEE:mailto:evil@example.com',
		'x'
	])('refuses a recurrence it did not build itself: %j', (recurrence) => {
		expect(() => invite({ table: { ...campaign, recurrence } })).toThrow(/recurrence/i);
	});
});

describe('a CANCEL', () => {
	it('names the same event so the calendar removes it, with a higher sequence', () => {
		const ics = invite({ method: 'CANCEL', table: { ...table, icalSequence: 3 } });

		expect(lines(ics)).toEqual(
			expect.arrayContaining([
				'METHOD:CANCEL',
				'STATUS:CANCELLED',
				`UID:${table.id}@mesaaberta.app`,
				'SEQUENCE:3'
			])
		);
	});
});

describe('the sequence and the identity of the event', () => {
	it('keeps the UID through every edit and raises only the sequence, so an update replaces the event', () => {
		const first = invite({ table: { ...table, icalSequence: 0 } });
		const edited = invite({ table: { ...table, title: 'Novo nome', icalSequence: 4 } });

		expect(named(first, 'UID')).toEqual(named(edited, 'UID'));
		expect(named(edited, 'SEQUENCE')).toEqual(['SEQUENCE:4']);
	});
});

describe('who sees whom', () => {
	it("lists the recipient as the only attendee, so nobody learns another player's email", () => {
		const ics = invite({ attendee: { email: 'ana@example.com', name: 'Ana' } });

		const attendees = named(ics, 'ATTENDEE');
		expect(attendees).toHaveLength(1);
		expect(attendees[0]).toContain('mailto:ana@example.com');
		expect(ics).not.toContain('bruno@example.com');
	});

	it('gives each recipient their own copy', () => {
		const ana = invite({ attendee: { email: 'ana@example.com' } });
		const bruno = invite({ attendee: { email: 'bruno@example.com' } });

		expect(ana).toContain('ana@example.com');
		expect(ana).not.toContain('bruno@example.com');
		expect(bruno).toContain('bruno@example.com');
		expect(bruno).not.toContain('ana@example.com');
	});

	it('names the organizer as the sender address, not a player', () => {
		expect(named(invite(), 'ORGANIZER')).toEqual([
			'ORGANIZER;CN="Mesa Aberta":mailto:convites@mesaaberta.app'
		]);
	});
});

describe('escaping', () => {
	it('escapes commas, semicolons, backslashes and line breaks in text', () => {
		const ics = invite({
			table: { ...table, title: 'A, B; C \\ D', description: 'linha 1\nlinha 2' }
		});

		expect(named(ics, 'SUMMARY')).toEqual(['SUMMARY:A\\, B\\; C \\\\ D']);
		expect(unescape(named(ics, 'DESCRIPTION')[0].slice('DESCRIPTION:'.length))).toContain(
			'linha 1\nlinha 2'
		);
	});

	it('leaves no unescaped separator in any text value, whatever the input', () => {
		const ics = invite({
			table: { ...table, title: 'a,b;c\\d', description: 'x,y;z', extraInfo: ';,\\' }
		});

		for (const name of ['SUMMARY', 'DESCRIPTION']) {
			const value = named(ics, name)[0].slice(name.length + 1);
			// A comma or semicolon is only allowed right after a backslash (which is itself not escaped).
			expect(value.replace(/\\\\/g, '')).not.toMatch(/(?<!\\)[;,]/);
		}
	});

	it('folds long lines at 75 bytes and never splits a multi-byte character', () => {
		const long =
			'Crônicas de Arton, a saga do herói sem coração e do dragão dourado: ação e emoção. '.repeat(
				6
			);
		const ics = invite({ table: { ...table, title: long } });

		for (const physical of ics.split('\r\n')) expect(byteLength(physical)).toBeLessThanOrEqual(75);
		expect(unescape(named(ics, 'SUMMARY')[0].slice('SUMMARY:'.length))).toBe(long);
	});

	describe('cannot be used to inject fields (CRLF injection)', () => {
		const attack =
			'x\r\nATTENDEE:mailto:evil@example.com\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nATTACH:http://evil.example';

		it.each([
			['title', { title: attack }],
			['description', { description: attack }],
			['extra info', { extraInfo: attack }],
			['slug', { slug: attack }]
		])('in the %s', (_field, over) => {
			const ics = invite({ table: { ...table, ...over } });

			expect(named(ics, 'ATTENDEE')).toHaveLength(1);
			expect(named(ics, 'ATTENDEE')[0]).toContain('ana@example.com');
			expect(lines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
			expect(lines(ics).filter((l) => l === 'END:VEVENT')).toHaveLength(1);
			expect(named(ics, 'ATTACH')).toHaveLength(0);
			// Lenient parsers also break a line at a bare LF or CR, so there must be none.
			expect(ics).not.toMatch(/(?<!\r)\n|\r(?!\n)/);
			expect(ics).not.toContain('evil@example.com\r\n');
		});

		it('in the attendee name, which is quoted and cleaned', () => {
			const ics = invite({
				attendee: { email: 'ana@example.com', name: 'Ana"\r\nATTENDEE:mailto:evil@example.com' }
			});

			expect(named(ics, 'ATTENDEE')).toHaveLength(1);
			expect(named(ics, 'ATTENDEE')[0]).not.toMatch(/evil@example\.com$/);
		});

		it.each([
			'ana@example.com\r\nATTENDEE:mailto:evil@example.com',
			'ana example@x.com',
			'ana@example.com>',
			'',
			'not-an-email'
		])('refuses an address that is not an address: %j', (email) => {
			expect(() => invite({ attendee: { email } })).toThrow(/email/i);
		});
	});
});

describe('read back by an independent parser (ical.js)', () => {
	const parse = (ics: string) => {
		const calendar = new ICAL.Component(ICAL.parse(ics));
		const vevent = calendar.getFirstSubcomponent('vevent')!;
		return { calendar, vevent, event: new ICAL.Event(vevent) };
	};

	it("sees one event with the title, the start in the table's zone and one attendee", () => {
		const { calendar, vevent, event } = parse(invite());

		expect(calendar.getFirstPropertyValue('method')).toBe('REQUEST');
		expect(calendar.getAllSubcomponents('vevent')).toHaveLength(1);
		expect(event.summary).toBe('Mesa do Dragão');
		expect(event.uid).toBe(`${table.id}@mesaaberta.app`);
		expect(event.startDate.toString()).toBe('2026-10-10T19:00:00');
		expect(event.startDate.zone.tzid).toBe('America/Sao_Paulo');
		expect(event.duration.toSeconds()).toBe(240 * 60);
		expect(vevent.getAllProperties('attendee')).toHaveLength(1);
		expect(String(vevent.getFirstPropertyValue('attendee'))).toBe('mailto:ana@example.com');
	});

	it('sees a weekly rule and its end for a campaign', () => {
		const until = new Date('2026-12-02T02:59:00Z');
		const { event } = parse(
			invite({ table: { ...table, kind: 'campaign', recurrence: 'FREQ=WEEKLY;INTERVAL=2', until } })
		);

		expect(event.isRecurring()).toBe(true);
		const rule = event.component.getFirstPropertyValue('rrule') as InstanceType<typeof ICAL.Recur>;
		expect(rule.freq).toBe('WEEKLY');
		expect(rule.interval).toBe(2);
		expect(rule.until?.toString()).toBe('2026-12-02T02:59:00Z');
	});

	it('reads back exactly what was written, however hostile the text', () => {
		const hostile = 'A, B; C \\ D\r\nATTENDEE:mailto:evil@example.com\nEND:VEVENT';
		const { calendar, vevent, event } = parse(invite({ table: { ...table, title: hostile } }));

		expect(calendar.getAllSubcomponents('vevent')).toHaveLength(1);
		expect(vevent.getAllProperties('attendee')).toHaveLength(1);
		expect(event.summary).toBe(hostile.replace(/\r\n/g, '\n'));
	});

	it('reads a cancellation', () => {
		const { calendar, vevent } = parse(
			invite({ method: 'CANCEL', table: { ...table, icalSequence: 2 } })
		);

		expect(calendar.getFirstPropertyValue('method')).toBe('CANCEL');
		expect(vevent.getFirstPropertyValue('status')).toBe('CANCELLED');
		expect(vevent.getFirstPropertyValue('sequence')).toBe(2);
	});
});
