import { describe, expect, it } from 'vitest';
import { standingOf } from '@mesaaberta/core/profile/standing';

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

  it('is banned when an old suspended row has a ban that never ends', () => {
    expect(standingOf({ status: 'suspended', bannedAt: at, bannedUntil: null })).toBe('banned');
  });

  it('reads the banned and closed statuses as they are', () => {
    expect(standingOf({ status: 'banned', bannedAt: at, bannedUntil: null })).toBe('banned');
    expect(standingOf({ status: 'closed', bannedAt: null, bannedUntil: null })).toBe('closed');
  });

  it('reads an old closed account (suspended, no ban on it) as closed', () => {
    expect(standingOf({ status: 'suspended', bannedAt: null, bannedUntil: null })).toBe('closed');
  });
});
