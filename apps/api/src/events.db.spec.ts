import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '@mesaaberta/db/schema';
import { MAX_ATTEMPTS } from '@mesaaberta/core/server/events/dispatcher';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { createTestDb } from '../../web/src/lib/server/db/test-db';

// No handler is listening, so a forced event is simply done: what is under test is the route over a
// real database (the admin check, the conditional update and the audit entry), not the handlers.
vi.mock('@mesaaberta/core/server/events/handlers', () => ({ handlersFor: () => [] }));

import { ACTOR_HEADER, eventRoutes } from './events';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-0000000009a1';
const member = '00000000-0000-4000-8000-0000000009a2';
const suspended = '00000000-0000-4000-8000-0000000009a3';
const t0 = new Date('2026-10-01T12:00:00Z');
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
    { id: suspended, username: 'suspended', role: 'admin', status: 'suspended' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

// The api closes the connection it opens; the shared test database must stay open.
const app = () => eventRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (path: string, actor?: string) =>
  app().request(path, { method: 'POST', headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);
const failed = async () => {
  const id = await recordEvent(
    test.db,
    { type: 'TableCreated', actorId: admin, payload: { tableId: 't', slug: 's', title: 'T' } },
    { now: t0 },
  );
  await test.db
    .update(events)
    .set({ attempts: MAX_ATTEMPTS, failedAt: t0, lastError: 'Error: boom' })
    .where(eq(events.id, id));
  return id;
};

describe('api admin event routes over a database', () => {
  it('runs a given-up event for an admin and records who asked', async () => {
    const id = await failed();

    const response = await post(`/${id}/force`, admin);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'processed' });
    const [row] = await test.db.select().from(events).where(eq(events.id, id));
    expect(row.processedAt).not.toBeNull();
    const entries = await test.db.select().from(events).where(eq(events.type, 'EventForced'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorId: admin, payload: { eventId: id } });
  });

  it('retries every given-up event and reports what is left', async () => {
    await failed();
    await failed();

    const response = await post('/retry-failed', admin);

    expect(await response.json()).toEqual({ tried: 2, processed: 2, remaining: 0 });
  });

  it('answers not_found for an event that does not exist', async () => {
    const response = await post('/00000000-0000-4000-8000-000000000999/force', admin);

    expect(await response.json()).toEqual({ outcome: 'not_found' });
  });

  it('refuses a member, a suspended admin and an unknown actor, and runs nothing', async () => {
    const id = await failed();

    for (const actor of [member, suspended, '00000000-0000-4000-8000-0000000009ff']) {
      expect((await post(`/${id}/force`, actor)).status).toBe(403);
    }
    expect((await post(`/${id}/force`)).status).toBe(401);

    const [row] = await test.db.select().from(events).where(eq(events.id, id));
    expect(row.processedAt).toBeNull();
  });
});
