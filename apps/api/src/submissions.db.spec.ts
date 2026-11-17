import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { crowdfundings, events, partners, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { submissionRoutes } from './submissions';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000ea1';
const bia = '00000000-0000-4000-8000-000000000ea2';
const env = { DATABASE_URL: 'postgres://test' };
let partnerId: string;

const partner = {
  name: 'Loja Teste',
  description: 'Uma loja',
  types: ['shop'],
  contactEmail: '',
  siteUrl: 'https://loja.example',
  backlinkUrl: '',
  couponCode: '',
  couponDescription: '',
  linkNetwork: [],
  linkUrl: [],
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
});
afterAll(() => test.close());

const app = () => submissionRoutes((() => ({ db: test.db, close: async () => {} })) as never);
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

describe('api submission routes over a database', () => {
  it('adds a partner as the actor with the logo the web Worker stored', async () => {
    const response = await post(
      '/partners',
      { input: partner, logoPath: 'partners/ana/logo.png' },
      ana,
    );

    expect(response.status).toBe(200);
    const { eventIds } = (await response.json()) as { eventIds: string[] };
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({ actorId: ana });
    const [row] = await test.db.select().from(partners).where(eq(partners.submitterId, ana));
    expect(row).toMatchObject({ name: 'Loja Teste', logoPath: 'partners/ana/logo.png' });
    partnerId = row.id;
  });

  it('refuses a partner without a logo path, and an invalid form', async () => {
    expect((await post('/partners', { input: partner }, ana)).status).toBe(400);
    expect(
      (await post('/partners', { input: { ...partner, siteUrl: '' }, logoPath: 'p/x.png' }, ana))
        .status,
    ).toBe(400);
  });

  it('lets only the submitter edit, and answers the replaced logo', async () => {
    expect(
      (await post(`/partners/${partnerId}`, { input: { ...partner, name: 'Roubada' } }, bia))
        .status,
    ).toBeGreaterThanOrEqual(403);

    const response = await post(
      `/partners/${partnerId}`,
      { input: { ...partner, name: 'Loja Nova' }, logoPath: 'partners/ana/novo.png' },
      ana,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ replacedLogo: 'partners/ana/logo.png' });
  });

  it('adds a crowdfunding campaign as the actor', async () => {
    const response = await post(
      '/crowdfundings',
      {
        input: {
          url: 'https://www.kickstarter.com/projects/x/y',
          name: 'Campanha',
          owner: 'Ana',
          startsOn: '2099-01-01',
          endsOn: '2099-02-01',
        },
        imagePath: null,
      },
      ana,
    );

    expect(response.status).toBe(200);
    const rows = await test.db
      .select()
      .from(crowdfundings)
      .where(eq(crowdfundings.submitterId, ana));
    expect(rows).toHaveLength(1);
  });

  it('answers 401 without an actor', async () => {
    expect((await post('/crowdfundings', {})).status).toBe(401);
  });
});
