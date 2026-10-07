import { describe, expect, it } from 'vitest';
import { daysLeft, daysToStart, isLastDays, phaseOf, todayIn } from './phase';

const campaign = { startsOn: '2026-10-10', endsOn: '2026-10-20' };
// 12:00 in São Paulo (UTC-3).
const at = (day: string) => new Date(`${day}T15:00:00Z`);

describe('phaseOf', () => {
  it('is upcoming the day before it starts', () => {
    expect(phaseOf(campaign, at('2026-10-09'))).toBe('upcoming');
  });

  it('is running on the first and on the last day', () => {
    expect(phaseOf(campaign, at('2026-10-10'))).toBe('running');
    expect(phaseOf(campaign, at('2026-10-20'))).toBe('running');
  });

  it('has ended the day after the end date', () => {
    expect(phaseOf(campaign, at('2026-10-21'))).toBe('ended');
  });

  it('reads the day in São Paulo, not in UTC', () => {
    // 01:00 UTC on the 21st is still the 20th at 22:00 in São Paulo.
    expect(phaseOf(campaign, new Date('2026-10-21T01:00:00Z'))).toBe('running');
    expect(todayIn(new Date('2026-10-21T01:00:00Z'))).toBe('2026-10-20');
  });
});

describe('daysLeft', () => {
  it('counts down to the end date, and is 0 on the last day', () => {
    expect(daysLeft(campaign, at('2026-10-15'))).toBe(5);
    expect(daysLeft(campaign, at('2026-10-20'))).toBe(0);
  });

  it('is null before it starts and after it ends', () => {
    expect(daysLeft(campaign, at('2026-10-09'))).toBeNull();
    expect(daysLeft(campaign, at('2026-10-21'))).toBeNull();
  });
});

describe('isLastDays', () => {
  it('warns from three days before the end, and not before', () => {
    expect(isLastDays(campaign, at('2026-10-16'))).toBe(false);
    expect(isLastDays(campaign, at('2026-10-17'))).toBe(true);
    expect(isLastDays(campaign, at('2026-10-20'))).toBe(true);
  });

  it('does not warn for an upcoming or an ended campaign', () => {
    expect(isLastDays(campaign, at('2026-10-01'))).toBe(false);
    expect(isLastDays(campaign, at('2026-11-01'))).toBe(false);
  });
});

describe('daysToStart', () => {
  it('counts the days until it opens, only while upcoming', () => {
    expect(daysToStart(campaign, at('2026-10-07'))).toBe(3);
    expect(daysToStart(campaign, at('2026-10-10'))).toBeNull();
  });
});
