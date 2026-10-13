import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, partners, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { moderationRoutes } from './moderation';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-0000000007a1';
const member = '00000000-0000-4000-8000-0000000007a2';
const partner = '00000000-0000-4000-8000-0000000007b1';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
  await test.db.insert(partners).values({
    id: partner,
    name: 'Loja Teste',
    description: 'Uma loja',
    logoPath: 'partners/x/logo.png',
    submitterId: member,
  } as never);
});
afterAll(() => test.close());

// The api closes the connection it opens; the shared test database must stay open.
const app = () => moderationRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (path: string, body: unknown, actor?: string) =>
  app().request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api moderation routes over a database', () => {
  it('approves a partner for an admin and answers the events to dispatch', async () => {
    const response = await post('/partner.approve', { id: partner }, admin);

    expect(response.status).toBe(200);
    const { eventIds } = (await response.json()) as { eventIds: string[] };
    expect(eventIds).toHaveLength(1);
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({ type: 'PartnerApproved', actorId: admin });
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partner));
    expect(row.approvedBy).toBe(admin);
  });

  it('refuses a second approval on the field the form names', async () => {
    const response = await post('/partner.approve', { id: partner }, admin);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid',
      field: 'id',
      message: 'already_approved',
    });
  });

  it('answers not_found for a partner that does not exist', async () => {
    const response = await post(
      '/partner.approve',
      { id: '00000000-0000-4000-8000-0000000007ff' },
      admin,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'id', message: 'not_found' });
  });

  it('takes a partner down with a reason and a note', async () => {
    const response = await post(
      '/partner.remove',
      { id: partner, reason: 'other', note: 'x' },
      admin,
    );

    expect(response.status).toBe(200);
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partner));
    expect(row.removedBy).toBe(admin);
  });

  it('refuses a body the form schema would refuse, and an unknown decision', async () => {
    expect((await post('/partner.approve', { id: 'nope' }, admin)).status).toBe(400);
    expect((await post('/everything.delete', {}, admin)).status).toBe(404);
    expect((await post('/toString', {}, admin)).status).toBe(404);
  });

  it('does not take a header for an admin', async () => {
    expect((await post('/partner.approve', { id: partner })).status).toBe(401);
    expect((await post('/partner.approve', { id: partner }, member)).status).toBe(403);
  });
});
