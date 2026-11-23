import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authAttempts } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import {
  SIGN_IN_LIMIT,
  accountWait,
  attemptKey,
  networkOf,
  recordSignInFailure,
  attemptWait,
  isLoopback,
  pruneAuthAttempts,
  recordAttempt,
} from '@mesaaberta/core/server/auth/attempt-limit';

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  test = await createTestDb();
});
beforeEach(async () => {
  await test.db.delete(authAttempts);
});
afterAll(() => test.close());

const limit = { action: 'sign_in', max: 3, windowSeconds: 600 } as const;
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes));
const dayLater = (date: Date) => new Date(date.getTime() + 24 * 3600_000 + 60_000);

describe('recordAttempt', () => {
  it('lets an address through up to the limit, then refuses it and says how long to wait', async () => {
    for (const minute of [0, 1, 2]) await recordAttempt(test.db, limit, '203.0.113.7', at(minute));

    await expect(recordAttempt(test.db, limit, '203.0.113.7', at(4))).rejects.toMatchObject({
      name: 'RateLimited',
      // The attempt at 12:00 leaves the 10-minute window at 12:10: six minutes after 12:04.
      retryAfterSeconds: 360,
    });
  });

  it('does not count a refused attempt, so waiting is enough', async () => {
    for (const minute of [0, 1, 2]) await recordAttempt(test.db, limit, '203.0.113.7', at(minute));
    await expect(recordAttempt(test.db, limit, '203.0.113.7', at(5))).rejects.toThrow();

    await expect(recordAttempt(test.db, limit, '203.0.113.7', at(11))).resolves.toBeUndefined();
  });

  it('counts each address and each action apart', async () => {
    for (const minute of [0, 1, 2]) await recordAttempt(test.db, limit, '203.0.113.7', at(minute));

    await expect(recordAttempt(test.db, limit, '198.51.100.2', at(3))).resolves.toBeUndefined();
    await expect(
      recordAttempt(test.db, { ...limit, action: 'sign_up' }, '203.0.113.7', at(3)),
    ).resolves.toBeUndefined();
  });

  it('stores a hash, never the address', async () => {
    await recordAttempt(test.db, SIGN_IN_LIMIT, '203.0.113.7', at(0));
    const rows = await test.db.select().from(authAttempts);
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7');
    expect(rows[0].key).toBe(await attemptKey('sign_in', '203.0.113.7'));
  });

  it("deletes only its own address's day-old attempts, never another's", async () => {
    await recordAttempt(test.db, SIGN_IN_LIMIT, '203.0.113.7', at(0));
    await recordAttempt(test.db, SIGN_IN_LIMIT, '198.51.100.2', at(0));

    await recordAttempt(test.db, SIGN_IN_LIMIT, '203.0.113.7', dayLater(at(1)));
    const keys = (await test.db.select().from(authAttempts)).map((row) => row.key).sort();
    expect(keys).toEqual(
      [
        await attemptKey('sign_in', '198.51.100.2'),
        await attemptKey('sign_in', '203.0.113.7'),
      ].sort(),
    );
  });
});

describe('pruneAuthAttempts', () => {
  it('forgets every attempt after a day, and keeps the recent ones', async () => {
    await recordAttempt(test.db, SIGN_IN_LIMIT, '203.0.113.7', at(0));
    await recordAttempt(test.db, SIGN_IN_LIMIT, '198.51.100.2', at(30));

    expect(await pruneAuthAttempts(test.db, dayLater(at(10)))).toBe(1);
    const rows = await test.db.select().from(authAttempts);
    expect(rows.map((row) => row.key)).toEqual([await attemptKey('sign_in', '198.51.100.2')]);
  });
});

describe('attemptWait', () => {
  it('says how long to wait past the limit, and nothing below it', async () => {
    const tight = { ...limit, max: 1 };
    expect(await attemptWait(test.db, tight, '203.0.113.9')).toBeNull();
    expect(await attemptWait(test.db, tight, '203.0.113.9')).toBeGreaterThan(0);
  });

  it('never limits this machine, only a visitor', async () => {
    expect(['127.0.0.1', '::1', '::ffff:127.0.0.1'].every(isLoopback)).toBe(true);
    expect(isLoopback('203.0.113.9')).toBe(false);

    const tight = { ...limit, max: 1 };
    expect(await attemptWait(test.db, tight, '127.0.0.1')).toBeNull();
    expect(await attemptWait(test.db, tight, '127.0.0.1')).toBeNull();
  });
});

describe('networkOf', () => {
  it('counts an IPv6 visitor by its /64, so a new address in it does not reset the limit', () => {
    expect(networkOf('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(networkOf('2001:DB8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
  });

  it('keeps IPv4 as it is, also when written as IPv6', () => {
    expect(networkOf('203.0.113.7')).toBe('203.0.113.7');
    expect(networkOf('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('shares one limit across a /64 in attemptWait', async () => {
    for (let n = 0; n < SIGN_IN_LIMIT.max; n++)
      expect(
        await attemptWait(test.db, SIGN_IN_LIMIT, `2001:db8:1:2::${n.toString(16)}`),
      ).toBeNull();
    expect(await attemptWait(test.db, SIGN_IN_LIMIT, '2001:db8:1:2::ffff')).toBeGreaterThan(0);
  });
});

describe('the per-account sign-in limit', () => {
  const account = { action: 'sign_in_failed_account', max: 2, windowSeconds: 600 } as const;

  it('stops guesses at one e-mail from any network once it had too many wrong passwords', async () => {
    expect(await accountWait(test.db, account, 'ana@example.com', at(0))).toBeNull();
    await recordSignInFailure(test.db, account, 'ana@example.com', at(0));
    await recordSignInFailure(test.db, account, ' ANA@example.com', at(1));
    // The first failure leaves the 10-minute window at 12:10, eight minutes after 12:02.
    expect(await accountWait(test.db, account, 'ana@example.com', at(2))).toBe(480);
    expect(await accountWait(test.db, account, 'bia@example.com', at(2))).toBeNull();
  });

  it('never throws when the account is already over the limit', async () => {
    for (const minute of [0, 1, 2])
      await expect(
        recordSignInFailure(test.db, account, 'ana@example.com', at(minute)),
      ).resolves.toBeUndefined();
  });
});
