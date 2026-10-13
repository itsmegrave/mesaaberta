import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Logger } from '../logger';
import { dispatchEvent, sweepEvents } from './dispatcher';
import { registerFencing } from './fencing';
import { recordEvent } from './outbox';
import type { Handler } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-10T12:00:00Z');
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
const actor = '00000000-0000-4000-8000-000000000902';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const LEASE_MS = 2 * 60_000;

const log = () => {
  const warn = vi.fn();
  return { warn, logger: { info() {}, warn, error() {}, debug() {} } as unknown as Logger };
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: actor, username: 'bia' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

const record = (when = t0) =>
  recordEvent(test.db, { type: 'TableCreated', actorId: actor, payload }, { now: when });
const row = async (id: string) => (await test.db.select().from(events).where(eq(events.id, id)))[0];
const named = (name: string, run: Handler['handle']): Handler => ({
  name,
  types: ['TableCreated'],
  handle: run,
});

describe('owner-fenced leases', () => {
  it('holds a token while the handlers run and clears it when the event is done', async () => {
    const id = await record();
    let tokenDuring: string | null = null;
    const handler = named('mail', async () => {
      tokenDuring = (await row(id)).claimToken;
    });

    await dispatchEvent(test.db, [handler], id, t0, log().logger, { fenced: true });

    expect(tokenDuring).toMatch(/^[0-9a-f-]{36}$/);
    expect(await row(id)).toMatchObject({ claimToken: null, claimedUntil: null });
    expect((await row(id)).processedAt).not.toBeNull();
  });

  it('leaves no token behind on the unfenced path', async () => {
    const id = await record();
    let tokenDuring: string | null = 'unset';
    const handler = named('mail', async () => {
      tokenDuring = (await row(id)).claimToken;
    });

    await dispatchEvent(test.db, [handler], id, t0, log().logger, { fenced: false });

    expect(tokenDuring).toBeNull();
  });

  it('stops a dispatcher whose lease was taken over, and leaves the new claim alone', async () => {
    const id = await record();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const handler = named('mail', async () => {
      calls += 1;
      if (calls === 1) await held; // A is slow; B takes the event over meanwhile
    });
    const a = log();

    const first = dispatchEvent(test.db, [handler], id, t0, a.logger, { fenced: true });
    // Wait until A holds the claim, then let its lease run out.
    await vi.waitFor(async () => expect((await row(id)).claimToken).not.toBeNull());
    await test.db
      .update(events)
      .set({ claimedUntil: new Date(t0.getTime() - 1000) })
      .where(eq(events.id, id));

    await dispatchEvent(test.db, [handler], id, at(60), log().logger, { fenced: true });
    const afterB = await row(id);
    expect(afterB.processedAt).toEqual(at(60));
    expect(afterB.handledBy).toEqual(['mail']);

    release();
    await first;

    const final = await row(id);
    expect(final.processedAt).toEqual(at(60)); // not overwritten by A
    expect(final.handledBy).toEqual(['mail']); // appended once, by B
    expect(final.attempts).toBe(0);
    expect(a.warn).toHaveBeenCalledWith(
      'event.lease.lost',
      expect.objectContaining({ eventId: id }),
    );
  });

  it('keeps a stale failure from scheduling a retry over the new claim', async () => {
    const id = await record();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const handler = named('mail', async () => {
      calls += 1;
      if (calls === 1) {
        await held;
        throw new Error('provider 503');
      }
    });

    const first = dispatchEvent(test.db, [handler], id, t0, log().logger, { fenced: true });
    await vi.waitFor(async () => expect((await row(id)).claimToken).not.toBeNull());
    await test.db
      .update(events)
      .set({ claimedUntil: new Date(t0.getTime() - 1000) })
      .where(eq(events.id, id));
    await dispatchEvent(test.db, [handler], id, at(60), log().logger, { fenced: true });

    release();
    await first;

    const final = await row(id);
    expect(final.processedAt).toEqual(at(60));
    expect(final.attempts).toBe(0);
    expect(final.lastError).toBeNull();
  });

  it('lets an unfenced claim invalidate a fenced holder', async () => {
    const id = await record();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const handler = named('mail', async () => {
      calls += 1;
      if (calls === 1) await held;
    });

    const first = dispatchEvent(test.db, [handler], id, t0, log().logger, { fenced: true });
    await vi.waitFor(async () => expect((await row(id)).claimToken).not.toBeNull());
    await test.db
      .update(events)
      .set({ claimedUntil: new Date(t0.getTime() - 1000) })
      .where(eq(events.id, id));
    await dispatchEvent(test.db, [handler], id, at(60), log().logger, { fenced: false });

    release();
    await first;

    expect((await row(id)).processedAt).toEqual(at(60));
    expect((await row(id)).handledBy).toEqual(['mail']);
  });

  it('claims each event of a sweep with a fresh clock', async () => {
    const first = await record(at(-10));
    const second = await record(at(-5));
    const seenLeaseEnds: Date[] = [];
    let tick = 0;
    const clock = () => at((tick += 300)); // every claim is five minutes later than the last
    const handler = named('mail', async (event) => {
      const claimed = (await row(event.id)).claimedUntil;
      if (claimed) seenLeaseEnds.push(claimed);
    });

    await sweepEvents(test.db, [handler], t0, 50, log().logger, { fenced: true, clock });

    expect(first).not.toBe(second);
    expect(seenLeaseEnds).toHaveLength(2);
    // Claim 1 at +300s, claim 2 at +600s: a stale `t0` would give both the same lease end.
    expect(seenLeaseEnds[0]).toEqual(new Date(at(300).getTime() + LEASE_MS));
    expect(seenLeaseEnds[1]).toEqual(new Date(at(900).getTime() + LEASE_MS));
  });

  it('follows the request flag registered for the connection when no option is passed', async () => {
    const id = await record();
    registerFencing(test.db, async () => true);
    let tokenDuring: string | null = null;
    const handler = named('mail', async () => {
      tokenDuring = (await row(id)).claimToken;
    });

    await dispatchEvent(test.db, [handler], id, t0, log().logger);

    expect(tokenDuring).not.toBeNull();
    registerFencing(test.db, async () => {
      throw new Error('flags unreachable');
    });
    const other = await record();
    let tokenOther: string | null = 'unset';
    await dispatchEvent(
      test.db,
      [
        named('mail', async () => {
          tokenOther = (await row(other)).claimToken;
        }),
      ],
      other,
      t0,
      log().logger,
    );
    expect(tokenOther).toBeNull(); // an unreadable flag is the unfenced path
  });
});
