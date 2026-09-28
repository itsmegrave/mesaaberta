import { describe, expect, it } from 'vitest';
import {
	instantToLocal,
	localToInstant,
	nextOccurrence,
	weeklyInterval,
	type Schedule
} from './schedule';

const at = (iso: string) => new Date(iso);

const oneShot = { kind: 'one_shot' as const, recurrence: null, until: null };
const weekly = (over: Partial<Schedule> & Pick<Schedule, 'startsAt' | 'timezone'>): Schedule => ({
	kind: 'campaign',
	recurrence: 'FREQ=WEEKLY',
	until: null,
	...over
});

describe('nextOccurrence', () => {
	describe('a one-shot', () => {
		const table = {
			...oneShot,
			startsAt: at('2026-10-10T22:00:00Z'),
			timezone: 'America/Sao_Paulo'
		};

		it('is its start while that is ahead', () => {
			expect(nextOccurrence(table, at('2026-10-01T00:00:00Z'))).toEqual(table.startsAt);
		});

		it('is still coming at the very moment it starts', () => {
			expect(nextOccurrence(table, at('2026-10-10T22:00:00Z'))).toEqual(table.startsAt);
		});

		it('is over once it has started and passed', () => {
			expect(nextOccurrence(table, at('2026-10-10T22:00:01Z'))).toBeNull();
		});
	});

	describe('a weekly campaign', () => {
		const table = weekly({ startsAt: at('2026-10-03T21:00:00Z'), timezone: 'America/Sao_Paulo' });

		it('is its first session while that is ahead', () => {
			expect(nextOccurrence(table, at('2026-09-20T00:00:00Z'))).toEqual(table.startsAt);
		});

		it('is the coming week once the first has passed', () => {
			expect(nextOccurrence(table, at('2026-10-04T00:00:00Z'))).toEqual(at('2026-10-10T21:00:00Z'));
		});

		it('is still the same session at the moment it starts', () => {
			expect(nextOccurrence(table, at('2026-10-10T21:00:00Z'))).toEqual(at('2026-10-10T21:00:00Z'));
		});

		it('keeps counting weeks a long way past the start', () => {
			// 2026-10-03 + 52 weeks = 2027-10-02
			expect(nextOccurrence(table, at('2027-09-30T00:00:00Z'))).toEqual(at('2027-10-02T21:00:00Z'));
		});
	});

	it('steps two weeks at a time for INTERVAL=2', () => {
		const table = weekly({
			recurrence: 'FREQ=WEEKLY;INTERVAL=2',
			startsAt: at('2026-10-03T21:00:00Z'),
			timezone: 'America/Sao_Paulo'
		});

		expect(nextOccurrence(table, at('2026-10-04T00:00:00Z'))).toEqual(at('2026-10-17T21:00:00Z'));
	});

	it('keeps the wall-clock time across a daylight-saving change', () => {
		// 20:00 in New York. The clocks go forward on 2026-03-08, so 20:00 is 01:00Z before and 00:00Z after.
		const table = weekly({ startsAt: at('2026-03-03T01:00:00Z'), timezone: 'America/New_York' });

		// The naive "+7 days" would give 01:00Z on the 10th, an hour late on the clock.
		expect(nextOccurrence(table, at('2026-03-04T00:00:00Z'))).toEqual(at('2026-03-10T00:00:00Z'));
		expect(nextOccurrence(table, at('2026-03-11T00:00:00Z'))).toEqual(at('2026-03-17T00:00:00Z'));
	});

	describe('until', () => {
		const table = weekly({
			startsAt: at('2026-10-03T21:00:00Z'),
			timezone: 'America/Sao_Paulo',
			until: at('2026-10-20T00:00:00Z')
		});

		it('still allows a session on or before the end date', () => {
			expect(nextOccurrence(table, at('2026-10-11T00:00:00Z'))).toEqual(at('2026-10-17T21:00:00Z'));
		});

		it('is over when the next session would fall after it', () => {
			expect(nextOccurrence(table, at('2026-10-18T00:00:00Z'))).toBeNull();
		});
	});

	it('treats a recurrence it does not understand like a single date, never guessing a schedule', () => {
		const table = weekly({
			recurrence: 'FREQ=DAILY',
			startsAt: at('2026-10-03T21:00:00Z'),
			timezone: 'America/Sao_Paulo'
		});

		expect(nextOccurrence(table, at('2026-09-20T00:00:00Z'))).toEqual(table.startsAt);
		expect(nextOccurrence(table, at('2026-10-04T00:00:00Z'))).toBeNull();
	});

	it('keeps the wall-clock time when the clocks go back, too', () => {
		// 20:00 in New York: 00:00Z in EDT (until 2026-11-01), 01:00Z in EST after.
		const table = weekly({ startsAt: at('2026-10-28T00:00:00Z'), timezone: 'America/New_York' });

		expect(nextOccurrence(table, at('2026-10-29T00:00:00Z'))).toEqual(at('2026-11-04T01:00:00Z'));
	});

	it('follows a southern-hemisphere change the other way round', () => {
		// 19:00 in Sydney: +10 until 2026-10-04, then +11, so 09:00Z becomes 08:00Z.
		const table = weekly({ startsAt: at('2026-09-29T09:00:00Z'), timezone: 'Australia/Sydney' });

		expect(nextOccurrence(table, at('2026-09-30T00:00:00Z'))).toEqual(at('2026-10-06T08:00:00Z'));
	});
});

describe('weeklyInterval', () => {
	it('understands only what the table form writes', () => {
		expect(weeklyInterval('FREQ=WEEKLY')).toBe(1);
		expect(weeklyInterval('FREQ=WEEKLY;INTERVAL=2')).toBe(2);
		expect(weeklyInterval('FREQ=WEEKLY;INTERVAL=3')).toBe(3);
		expect(weeklyInterval(null)).toBeNull();
	});

	it('refuses any other rule instead of reading part of it', () => {
		for (const rule of [
			'FREQ=DAILY',
			'FREQ=WEEKLY;BYDAY=MO',
			'FREQ=WEEKLY;INTERVAL=0',
			'FREQ=WEEKLY;INTERVAL=2;COUNT=5',
			'freq=weekly'
		]) {
			expect(weeklyInterval(rule), rule).toBeNull();
		}
	});
});

describe('localToInstant and instantToLocal', () => {
	it('go there and back in a zone', () => {
		const instant = localToInstant('2026-10-10T19:00', 'America/Sao_Paulo');
		expect(instant).toEqual(at('2026-10-10T22:00:00Z'));
		expect(instantToLocal(instant, 'America/Sao_Paulo')).toBe('2026-10-10T19:00');
	});

	it('reads a time the clocks skip as the time after the gap, as calendars do', () => {
		// New York skips 02:00–03:00 on 2026-03-08: 02:30 is taken as 03:30 EDT.
		expect(localToInstant('2026-03-08T02:30', 'America/New_York')).toEqual(
			at('2026-03-08T07:30:00Z')
		);
	});

	it('reads a time the clocks show twice as the first of the two', () => {
		// New York shows 01:00–02:00 twice on 2026-11-01: 01:30 is taken as 01:30 EDT.
		expect(localToInstant('2026-11-01T01:30', 'America/New_York')).toEqual(
			at('2026-11-01T05:30:00Z')
		);
	});
});
