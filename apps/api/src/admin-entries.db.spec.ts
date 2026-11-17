import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { adminEntryRoutes } from './admin-entries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-000000000ea1';
const member = '00000000-0000-4000-8000-000000000ea2';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
});
afterAll(() => test.close());

const post = (body: unknown, actor: string) =>
  adminEntryRoutes((() => ({ db: test.db, close: async () => {} })) as never).request(
    '/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ACTOR_HEADER]: actor },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api admin entry route over a database', () => {
  it('records the section once in the window and answers its event', async () => {
    const first = await post({ route: '/admin/users/[id]' }, admin);
    const { eventIds } = (await first.json()) as { eventIds: string[] };
    expect(eventIds).toHaveLength(1);
    const [row] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(row).toMatchObject({ type: 'AdminAreaEntered', actorId: admin });
    expect(row.payload).toEqual({ section: '/admin/users' });

    const again = await post({ route: '/admin/users' }, admin);
    expect(await again.json()).toEqual({ eventIds: [] });
  });

  it('refuses a member and a route outside the admin area', async () => {
    expect((await post({ route: '/admin' }, member)).status).toBe(403);
    expect((await post({ route: '/tables' }, admin)).status).toBe(400);
  });
});
