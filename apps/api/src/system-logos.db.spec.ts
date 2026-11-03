import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profiles, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { systemLogoRoutes } from './system-logos';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-0000000072a1';
const member = '00000000-0000-4000-8000-0000000072a2';
const env = { DATABASE_URL: 'postgres://test' };
let systemId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.delete(systems);
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
  [{ id: systemId }] = await test.db
    .insert(systems)
    .values({ name: 'Daggerheart', slug: 'daggerheart', position: 1 })
    .returning({ id: systems.id });
});
afterAll(() => test.close());

const app = () => systemLogoRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string, body?: unknown) =>
  app().request(
    path,
    body === undefined
      ? { headers: { [ACTOR_HEADER]: actor } }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', [ACTOR_HEADER]: actor },
          body: JSON.stringify(body),
        },
    env,
  );

describe('api system logo routes over a database', () => {
  it('keeps members out', async () => {
    expect((await call('/to-search', member)).status).toBe(403);
  });

  it('answers what to search, records a find and lists it for review', async () => {
    expect(await (await call('/to-search', admin)).json()).toEqual({
      systems: [{ id: systemId, name: 'Daggerheart', slug: 'daggerheart' }],
    });

    const recorded = await call('/record', admin, {
      systemId,
      found: {
        path: 'systems/dh.png',
        method: 'wikidata',
        confidence: 'high',
        imageUrl: 'https://upload.wikimedia.org/dh.png',
        sourcePage: 'https://commons.wikimedia.org/wiki/File:DH.svg',
        attribution: null,
        license: 'Public domain',
        note: null,
        wikidataId: 'Q2',
      },
      reason: null,
      wikidataId: 'Q2',
    });
    expect(await recorded.json()).toEqual({ unused: null });

    const list = (await (await call('/?status=pending', admin)).json()) as {
      logos: { slug: string; sourcePage: string }[];
    };
    expect(list.logos).toMatchObject([
      { slug: 'daggerheart', sourcePage: 'https://commons.wikimedia.org/wiki/File:DH.svg' },
    ]);
    expect((await call('/?status=pending&page=2', admin)).status).toBe(404);
  });

  it('refuses a bad body or an unknown action, and approves', async () => {
    expect((await call('/record', admin, { systemId: 'nope' })).status).toBe(400);
    expect(
      (
        await call('/record', admin, {
          systemId,
          found: { path: 'systems/x.png', imageUrl: 'http://x' },
        })
      ).status,
    ).toBe(400);
    expect((await call('/explode', admin, {})).status).toBe(404);
    expect((await call('/toString', admin, {})).status).toBe(404);

    expect(await (await call('/approveSure', admin, {})).json()).toEqual({ approved: 1 });
    const again = await call('/approve', admin, { systemId });
    expect(again.status).toBe(400);
    expect(await again.json()).toMatchObject({ field: 'systemId', message: 'not_pending' });
  });
});
