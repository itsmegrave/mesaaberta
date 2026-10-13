import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authAttempts } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { SIGN_IN_LIMIT, attemptKey, attemptWait, isLoopback, recordAttempt } from './attempt-limit';

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

  it('stores a hash, never the address, and forgets attempts after a day', async () => {
    await recordAttempt(test.db, SIGN_IN_LIMIT, '203.0.113.7', at(0));
    const rows = await test.db.select().from(authAttempts);
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7');
    expect(rows[0].key).toBe(await attemptKey('sign_in', '203.0.113.7'));

    await recordAttempt(
      test.db,
      SIGN_IN_LIMIT,
      '198.51.100.2',
      new Date(at(0).getTime() + 25 * 3600_000),
    );
    expect(await test.db.select().from(authAttempts)).toHaveLength(1);
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
