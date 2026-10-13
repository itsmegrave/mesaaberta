import { describe, expect, it } from 'vitest';
import { periodLabel, shortDay } from './format';

describe('shortDay', () => {
  it('writes the day and month in Portuguese, without the period an abbreviation carries', () => {
    expect(shortDay('2026-10-05', 'pt-BR')).toBe('5 de out');
  });

  it('is the same day whatever the machine zone, since a date has no time', () => {
    expect(shortDay('2026-01-01', 'pt-BR')).toBe('1 de jan');
  });
});

describe('periodLabel', () => {
  it('names the year only when the campaign crosses into another', () => {
    expect(periodLabel('2026-10-05', '2026-10-25', 'pt-BR')).toBe('5 de out – 25 de out');
    expect(periodLabel('2026-12-20', '2027-01-10', 'pt-BR')).toMatch(/2026.*2027/);
  });
});
