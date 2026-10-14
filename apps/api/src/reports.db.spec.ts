import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { crowdfundings, events, partners, profiles, reports } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { reportRoutes } from './reports';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000fa1';
const bia = '00000000-0000-4000-8000-000000000fa2';
const env = { DATABASE_URL: 'postgres://test' };
let partnerId: string;
let campaignId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
  const [partner] = await test.db
    .insert(partners)
    .values({
      submitterId: ana,
      name: 'Loja Teste',
      description: 'Uma loja',
      siteUrl: 'https://loja.example',
      logoPath: 'partners/ana/logo.png',
      approvedAt: new Date(),
    })
    .returning({ id: partners.id });
  partnerId = partner.id;
  const [campaign] = await test.db
    .insert(crowdfundings)
    .values({
      submitterId: ana,
      url: 'https://www.kickstarter.com/projects/x/y',
      platform: 'kickstarter',
      name: 'Campanha',
      owner: 'Ana',
      startsOn: '2099-01-01',
      endsOn: '2099-02-01',
    })
    .returning({ id: crowdfundings.id });
  campaignId = campaign.id;
});
afterAll(() => test.close());

const app = () => reportRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (action: string, body: unknown, actor?: string) =>
  app().request(
    `/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api report routes over a database', () => {
  it('files a partner report as the actor and answers the event to dispatch', async () => {
    const response = await post(
      'partner',
      { id: partnerId, reason: 'spam', details: 'Propaganda enganosa' },
      bia,
    );

    expect(response.status).toBe(200);
    const { eventIds } = (await response.json()) as { eventIds: string[] };
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({ actorId: bia });
    const rows = await test.db.select().from(reports).where(eq(reports.reporterId, bia));
    expect(rows).toHaveLength(1);
  });

  it('refuses a repeat while one waits, and one’s own partner', async () => {
    const again = await post('partner', { id: partnerId, reason: 'spam', details: '' }, bia);
    expect(again.status).toBe(400);
    expect(await again.json()).toMatchObject({ error: 'invalid' });

    const own = await post('partner', { id: partnerId, reason: 'spam', details: '' }, ana);
    expect(own.status).toBe(403);
  });

  it('files a campaign report', async () => {
    const response = await post(
      'crowdfunding',
      { id: campaignId, reason: 'spam', details: '' },
      bia,
    );

    expect(response.status).toBe(200);
  });

  it('lets only the submitter withdraw a partner', async () => {
    expect((await post('withdrawPartner', { id: partnerId }, bia)).status).toBe(403);

    const response = await post('withdrawPartner', { id: partnerId }, ana);
    expect(response.status).toBe(200);
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partnerId));
    expect(row.removedAt).not.toBeNull();
  });

  it('answers 404 for an unknown action, 400 for a bad form, 401 without an actor', async () => {
    expect((await post('everything', {}, ana)).status).toBe(404);
    expect((await post('partner', { id: 'nope' }, ana)).status).toBe(400);
    expect((await post('partner', {})).status).toBe(401);
  });
});
