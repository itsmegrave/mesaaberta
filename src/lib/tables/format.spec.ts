import { describe, expect, it } from 'vitest';
import { formatDuration, formatSession } from './format';

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
