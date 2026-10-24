import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, systems } from '@mesaaberta/db/schema';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { tableWriteRoutes } from './table-writes';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000ca1';
const other = '00000000-0000-4000-8000-000000000ca2';
const env = { DATABASE_URL: 'postgres://test' };
let input: TableInput;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre', role: 'member' },
    { id: other, username: 'outra', role: 'member' },
  ]);
  const [system] = await test.db
    .select({ slug: systems.slug })
    .from(systems)
    .where(eq(systems.status, 'approved'))
    .limit(1);
  input = {
    systemSlug: system.slug,
    title: 'Mesa pela api',
    description: '<p>Uma mesa</p>',
    extraInfo: null,
    welcomeMessage: null,
    kind: 'one_shot',
    capacity: 4,
    minPlayers: null,
    startsAtLocal: '2099-01-01T20:00',
    timezone: 'America/Sao_Paulo',
    durationMinutes: 180,
    recurrence: null,
    untilLocalDate: null,
    joinMode: 'auto',
    modality: 'online',
    locationArea: null,
    joinDetails: null,
    platforms: [],
    tags: [],
    postalCode: null,
    locationNeighbourhood: null,
    locationCity: null,
    locationState: null,
    removeImage: false,
  };
});
afterAll(() => test.close());

const open = (() => ({ db: test.db, close: async () => {} })) as never;
const app = () => tableWriteRoutes(open);
// Duplication has its own mount (`/v1/tables`), not the legacy `/v1/table-writes` one.
const duplicationApp = () => tableWriteRoutes(open, true);
const send = (mount: typeof app, path: string, body: unknown, actor?: string) =>
  mount().request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );
const post = (path: string, body: unknown, actor?: string) => send(app, path, body, actor);
const duplicate = (path: string, body: unknown, actor?: string) =>
  send(duplicationApp, path, body, actor);
let slug: string;

describe('api table write routes over a database', () => {
  it('creates a table for the actor and answers its slug and event', async () => {
    const response = await post('/', { input, imagePath: null, draft: false }, gm);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { eventIds: string[]; slug: string; draft: boolean };
    slug = body.slug;
    expect(body.draft).toBe(false);
    const [event] = await test.db.select().from(events).where(eq(events.id, body.eventIds[0]));
    expect(event).toMatchObject({ type: 'TableCreated', actorId: gm });
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.slug, slug));
    expect(row).toMatchObject({ gmId: gm, title: 'Mesa pela api' });
  });

  it('refuses an input the schema does not accept', async () => {
    const response = await post('/', { input: { ...input, capacity: 500 } }, gm);

    expect(response.status).toBe(400);
  });

  it('refuses an edit by someone who is not the GM', async () => {
    const response = await post(
      `/${slug}/update`,
      { input: { ...input, title: 'Roubada' } },
      other,
    );

    expect(response.status).toBe(403);
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.slug, slug));
    expect(row.title).toBe('Mesa pela api');
  });

  it('edits the table for its GM, keeping the slug', async () => {
    const response = await post(`/${slug}/update`, { input: { ...input, title: 'Novo nome' } }, gm);

    expect(response.status).toBe(200);
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.slug, slug));
    expect(row.title).toBe('Novo nome');
  });

  it('answers table_concluded, a code the web form words, for a concluded table', async () => {
    await test.db.update(gameTables).set({ status: 'concluded' }).where(eq(gameTables.slug, slug));
    const response = await post(`/${slug}/update`, { input }, gm);
    await test.db.update(gameTables).set({ status: 'active' }).where(eq(gameTables.slug, slug));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'table_concluded' });
  });

  it('disables the table for its GM and refuses everyone else', async () => {
    expect((await post(`/${slug}/disable`, {}, other)).status).toBe(403);
    const response = await post(`/${slug}/disable`, {}, gm);

    expect(response.status).toBe(200);
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.slug, slug));
    expect(row.status).toBe('disabled');
  });

  it('answers 404 for an unknown table or action and 401 without an actor', async () => {
    expect((await post('/nope/disable', {}, gm)).status).toBe(404);
    expect((await post(`/${slug}/explode`, {}, gm)).status).toBe(404);
    expect((await post('/', { input }, undefined)).status).toBe(401);
  });
});

describe('duplication api', () => {
  it('rejects another owner and missing new dates while reporting schedule conflicts as a date field', async () => {
    const original = await post('/', { input: { ...input, title: 'Fonte para duplicar' } }, gm);
    const source = (await original.json()) as { slug: string };
    expect(
      (
        await duplicate(
          `/${source.slug}/duplicate`,
          { input: { ...input, startsAtLocal: '2099-01-02T20:00' } },
          other,
        )
      ).status,
    ).toBe(403);
    expect(
      (await duplicate(`/${source.slug}/duplicate`, { input: { ...input, startsAtLocal: '' } }, gm))
        .status,
    ).toBe(400);
    const conflict = await duplicate(`/${source.slug}/duplicate`, { input }, gm);
    expect(conflict.status).toBe(400);
    expect(await conflict.json()).toMatchObject({
      field: 'startsAtLocal',
      message: 'schedule_conflict',
    });
  });
  it('duplicates through the shared action with a persistent request key and never publishes a draft', async () => {
    const original = await post('/', { input: { ...input, title: 'Fonte idempotente' } }, gm);
    const source = (await original.json()) as { slug: string };
    const payload = {
      input: { ...input, startsAtLocal: '2099-01-02T20:00' },
      requestKey: crypto.randomUUID(),
      draft: true,
    };
    const first = await duplicate(`/${source.slug}/duplicate`, payload, gm);
    expect(first.status).toBe(200);
    const copied = (await first.json()) as { slug: string; eventIds: string[]; draft: boolean };
    expect(await (await duplicate(`/${source.slug}/duplicate`, payload, gm)).json()).toEqual(
      copied,
    );
    expect(copied.draft).toBe(true);
    // The legacy mount never serves duplication, so there is one way in.
    expect((await post(`/${source.slug}/duplicate`, payload, gm)).status).toBe(404);
    const [event] = await test.db.select().from(events).where(eq(events.id, copied.eventIds[0]));
    expect(event.type).toBe('TableDrafted');
  });
});

it('loads duplication defaults only for its owner through the API', async () => {
  const created = await post(
    '/',
    { input: { ...input, title: 'Fonte API de cópia' }, imagePath: null },
    gm,
  );
  const { slug: source } = (await created.json()) as { slug: string };
  const read = (actor: string) =>
    duplicationApp().request(`/${source}/duplication`, { headers: { [ACTOR_HEADER]: actor } }, env);
  expect((await read(other)).status).toBe(403);
  const response = await read(gm);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    sourceSlug: source,
    input: { title: 'Fonte API de cópia', startsAtLocal: '' },
  });
});
