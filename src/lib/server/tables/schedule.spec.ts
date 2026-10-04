import { describe, expect, it } from 'vitest';
import { hasStarted, instantToLocal, localToInstant, weeklyInterval } from './schedule';

const at = (iso: string) => new Date(iso);

describe('hasStarted', () => {
  const startsAt = at('2026-10-10T22:00:00Z');

  it('is false while the session is ahead, so seats can still be asked for', () => {
    expect(hasStarted(startsAt, at('2026-10-10T21:59:59Z'))).toBe(false);
  });

  it('is true at the very moment it starts, closing the table to new requests', () => {
    expect(hasStarted(startsAt, at('2026-10-10T22:00:00Z'))).toBe(true);
  });

  it('stays true while the session runs and after it', () => {
    expect(hasStarted(startsAt, at('2026-10-10T23:00:00Z'))).toBe(true);
    expect(hasStarted(startsAt, at('2026-10-12T00:00:00Z'))).toBe(true);
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
      'freq=weekly',
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
      at('2026-03-08T07:30:00Z'),
    );
  });

  it('reads a time the clocks show twice as the first of the two', () => {
    // New York shows 01:00–02:00 twice on 2026-11-01: 01:30 is taken as 01:30 EDT.
    expect(localToInstant('2026-11-01T01:30', 'America/New_York')).toEqual(
      at('2026-11-01T05:30:00Z'),
    );
  });
});
