import { describe, expect, it } from 'vitest';
import { standingOf } from './standing';

const at = new Date('2026-10-01T12:00:00Z');

describe('standingOf', () => {
  it('is active for an active account, whatever an old ban left behind', () => {
    expect(standingOf({ status: 'active', bannedAt: at, bannedUntil: null })).toBe('active');
    expect(standingOf({ status: 'active', bannedAt: null, bannedUntil: null })).toBe('active');
  });

  it('is suspended while a ban has an end date', () => {
    expect(
      standingOf({ status: 'suspended', bannedAt: at, bannedUntil: new Date('2026-11-01') }),
    ).toBe('suspended');
  });

  it('is banned when the ban never ends', () => {
    expect(standingOf({ status: 'suspended', bannedAt: at, bannedUntil: null })).toBe('banned');
  });

  it('is suspended for a closed account, which has no ban on it', () => {
    expect(standingOf({ status: 'suspended', bannedAt: null, bannedUntil: null })).toBe(
      'suspended',
    );
  });
});
