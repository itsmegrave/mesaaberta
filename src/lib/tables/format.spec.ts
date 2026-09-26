import { describe, expect, it } from 'vitest';
import { formatCardDate, formatDuration, formatSession, formatWait } from './format';

describe('formatSession', () => {
	const start = new Date('2026-10-10T22:00:00Z');

	it('writes the weekday, date and time in Portuguese', () => {
		const text = formatSession(start, 'America/Sao_Paulo', 'pt-BR');

		expect(text).toMatch(/sábado/i);
		expect(text).toMatch(/10 de outubro/);
		expect(text).toMatch(/19:00/);
	});

	it("shows the time in the table's own timezone, and names it", () => {
		const saoPaulo = formatSession(start, 'America/Sao_Paulo', 'pt-BR');
		const newYork = formatSession(start, 'America/New_York', 'pt-BR');

		expect(saoPaulo).toMatch(/19:00/);
		expect(newYork).toMatch(/18:00/);
		expect(saoPaulo).not.toBe(newYork);
		expect(saoPaulo).toMatch(/GMT-3/);
	});

	it('is the same wherever it runs, so the page does not change when it hydrates', () => {
		expect(formatSession(start, 'America/Sao_Paulo', 'pt-BR')).toBe(
			formatSession(start, 'America/Sao_Paulo', 'pt-BR')
		);
	});
});

describe('formatDuration', () => {
	it.each([
		[240, '4 h'],
		[60, '1 h'],
		[150, '2 h 30 min'],
		[45, '45 min'],
		[90, '1 h 30 min']
	])('writes %i minutes as %j', (minutes, text) => {
		expect(formatDuration(minutes)).toBe(text);
	});
});

describe('formatWait', () => {
	it.each([
		[1, '1 min'],
		[59, '1 min'],
		[60, '1 min'],
		[61, '2 min'],
		[90, '2 min'],
		[15 * 60, '15 min'],
		[3600, '1 h'],
		[3601, '1 h 1 min']
	])('%i seconds is %s: rounded up, never promising a moment too early', (seconds, text) => {
		expect(formatWait(seconds)).toBe(text);
	});
});

describe('formatCardDate', () => {
	const start = new Date('2026-10-10T22:00:00Z');

	it('returns dayMonth and weekdayTime in Portuguese', () => {
		const res = formatCardDate(start, 'America/Sao_Paulo', 'pt-BR');

		expect(res.dayMonth).toBe('10 out');
		expect(res.weekdayTime).toMatch(/^sábado · /);
		expect(res.weekdayTime).toMatch(/19:00/);
		expect(res.weekdayTime).toMatch(/GMT-3/);
	});

	it('drops "-feira" from weekdays, as the card reference does', () => {
		// Friday, 9 October 2026, 20:30 in São Paulo.
		const res = formatCardDate(new Date('2026-10-09T23:30:00Z'), 'America/Sao_Paulo', 'pt-BR');

		expect(res.weekdayTime).toMatch(/^sexta · 20:30/);
	});
});
