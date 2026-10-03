import { expect, test } from 'vitest';
import { dayLabel, timeLabel } from './format';

// 19:00 in São Paulo (UTC-3) on Sunday, 4 Oct 2026.
const session = new Date('2026-10-04T22:00:00Z');

test('a session is written in its own zone, not the viewer’s, so 19:00 stays 19:00', () => {
  expect(dayLabel(session, 'pt-BR', 'America/Sao_Paulo')).toBe('dom, 4 out');
  expect(timeLabel(session, 'pt-BR', 'America/Sao_Paulo')).toBe('19:00 GMT-3');
  // The same moment in another zone is another day and hour: the zone is the table's.
  expect(timeLabel(session, 'pt-BR', 'UTC')).toBe('22:00 GMT');
});
