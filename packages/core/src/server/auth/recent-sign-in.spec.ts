import { describe, expect, it } from 'vitest';
import { lastSignInAt, signedInWithin } from './recent-sign-in';

const NOW = Date.UTC(2026, 10, 23, 12, 0, 0);
const at = (minutesAgo: number) => Math.floor((NOW - minutesAgo * 60_000) / 1000);

describe('lastSignInAt', () => {
  it('takes the newest authentication, so a fresh sign-in on an old session counts', () => {
    const claims = {
      amr: [
        { method: 'oauth', timestamp: at(600) },
        { method: 'password', timestamp: at(2) },
      ],
    };
    expect(lastSignInAt(claims)).toBe(at(2) * 1000);
  });

  it('is null without a usable time, so the change asks for a new sign-in', () => {
    expect(lastSignInAt({})).toBeNull();
    expect(lastSignInAt({ amr: 'password' })).toBeNull();
    expect(lastSignInAt({ amr: [{ method: 'password' }] })).toBeNull();
    expect(lastSignInAt(null)).toBeNull();
  });
});

describe('signedInWithin', () => {
  it('accepts a sign-in inside the window', () => {
    expect(signedInWithin(at(9) * 1000, 10, NOW)).toBe(true);
  });

  it('refuses a session that only stayed open past the window', () => {
    expect(signedInWithin(at(11) * 1000, 10, NOW)).toBe(false);
  });

  it('refuses no time at all and a time far in the future', () => {
    expect(signedInWithin(null, 10, NOW)).toBe(false);
    expect(signedInWithin(NOW + 10 * 60_000, 10, NOW)).toBe(false);
  });
});
