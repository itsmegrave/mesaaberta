import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  matchAnswers,
  matches,
  notifications,
  profileBlocks,
  profileFavoriteSystems,
  profiles,
  systems,
} from '@mesaaberta/db/schema';
import { matchesHandler } from '@mesaaberta/core/server/events/matches';
import { pruneMatchAnswers } from '@mesaaberta/core/server/matches/service';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { matchRoutes } from './matches';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-0000000a7c01';
const bia = '00000000-0000-4000-8000-0000000a7c02';
const caio = '00000000-0000-4000-8000-0000000a7c03';
const teen = '00000000-0000-4000-8000-0000000a7c04';
const dora = '00000000-0000-4000-8000-0000000a7c05';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    {
      id: ana,
      username: 'ana',
      ageRange: '25_34',
      tableRole: 'gm',
      city: 'Curitiba',
      availability: 0b111,
    },
    { id: bia, username: 'bia', ageRange: '18_24', tableRole: 'player', availability: 0b110 },
    { id: caio, username: 'caio', ageRange: '35_44', tableRole: 'player', city: 'Recife' },
    { id: teen, username: 'teen', ageRange: '13_17' },
    { id: dora, username: 'dora', ageRange: '25_34', tableRole: 'player' },
  ]);
  const [a, b] = await test.db.select({ id: systems.id }).from(systems).limit(2);
  await test.db.insert(profileFavoriteSystems).values([
    { profileId: ana, systemId: a.id },
    { profileId: ana, systemId: b.id },
    { profileId: bia, systemId: a.id },
  ]);
});
afterAll(() => test.close());

const app = () => matchRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string, method = 'GET', body?: unknown) =>
  app().request(
    path,
    {
      method,
      headers: {
        [ACTOR_HEADER]: actor,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const card = (seeking: string[], extra: Record<string, unknown> = {}) => ({
  enabled: true,
  adult: true,
  seeking,
  online: true,
  inPerson: false,
  combat: 30,
  rules: 30,
  length: 80,
  tone: 50,
  ...extra,
});
const answer = (actor: string, username: string, yes: boolean) =>
  call('/answers', actor, 'POST', { username, yes });

describe('api Combinar routes over a database', () => {
  it('reads an empty card with the profile facts the setup shows', async () => {
    expect(await (await call('/card', ana)).json()).toEqual({
      card: null,
      adult: true,
      minor: false,
      tableRole: 'gm',
      city: 'Curitiba',
      favoriteSystems: 2,
      availabilitySlots: 3,
      // Ana's own card as others would see it: her two systems, nothing "em comum".
      preview: expect.objectContaining({
        username: 'ana',
        tableRole: 'gm',
        commonSystems: [],
        fit: null,
      }),
    });
    expect(await (await call('/deck', ana)).json()).toEqual({ state: 'no_card' });
  });

  it('keeps minors and people without the confirmation out', async () => {
    const minor = await call('/card', teen, 'POST', card(['gm']));
    expect(minor.status).toBe(400);
    expect(await minor.json()).toMatchObject({ field: 'adult', message: 'adult_only' });
    expect(await (await call('/deck', teen)).json()).toEqual({ state: 'not_adult' });
    const unconfirmed = await call('/card', bia, 'POST', card(['gm'], { adult: false }));
    expect(await unconfirmed.json()).toMatchObject({ field: 'adult', message: 'adult_required' });
    // Presencial needs a city on the profile.
    const cityless = await call('/card', bia, 'POST', card(['gm'], { inPerson: true }));
    expect(await cityless.json()).toMatchObject({ field: 'inPerson', message: 'city_required' });
  });

  it('switches cards on, with their event, and deals the cards that fit', async () => {
    const saved = await call('/card', ana, 'POST', card(['players']));
    expect((await saved.json()).eventIds).toHaveLength(1);
    await call('/card', bia, 'POST', card(['gm'], { combat: 40 }));
    // Wants a group: never meets someone who only wants players.
    await call('/card', caio, 'POST', card(['group']));
    await call(
      '/card',
      dora,
      'POST',
      card(['gm'], { combat: 100, rules: 100, length: 0, tone: 0 }),
    );

    const deck = await (await call('/deck', ana)).json();
    expect(deck).toMatchObject({ state: 'ready', answersLeft: 50, canUndo: false });
    expect(deck.people.map((p: { username: string }) => p.username)).toEqual(['bia', 'dora']);
    expect(deck.people[0]).toMatchObject({
      username: 'bia',
      tableRole: 'player',
      online: true,
      bothOnline: true,
      commonSlots: 2,
      axes: { combat: 40, rules: 30, length: 80, tone: 50 },
      gm: null,
      player: null,
    });
    expect(deck.people[0].commonSystems).toHaveLength(1);
    expect(deck.people[0].score).toBeGreaterThan(deck.people[1].score);
  });

  it('keeps a yes secret until it is mutual, then makes the match and tells both', async () => {
    const first = await (await answer(ana, 'bia', true)).json();
    expect(first).toEqual({ eventIds: [], match: null });
    const deck = await (await call('/deck', ana)).json();
    expect(deck.people.map((p: { username: string }) => p.username)).toEqual(['dora']);

    const second = await (await answer(bia, 'ana', true)).json();
    expect(second.eventIds).toHaveLength(1);
    expect(second.match.person).toMatchObject({ username: 'ana', tableRole: 'gm' });
    expect(await test.db.select().from(matchAnswers)).toEqual([]);

    const [event] = await test.db.select().from(events).where(eq(events.id, second.eventIds[0]));
    await matchesHandler.handle(event as never, test.db);
    const told = await test.db
      .select({ to: notifications.recipientId, from: notifications.actorId })
      .from(notifications)
      .where(eq(notifications.type, 'match_created'));
    expect(told).toHaveLength(2);
    expect(told).toEqual(
      expect.arrayContaining([
        { to: ana, from: bia },
        { to: bia, from: ana },
      ]),
    );

    // Matched: out of each other's deck, and on both lists.
    expect((await (await call('/deck', bia)).json()).people).toEqual([]);
    const list = await (await call('/', ana)).json();
    expect(list).toMatchObject({ total: 1, pages: 1, items: [{ person: { username: 'bia' } }] });
    expect((await call('/?page=2', ana)).status).toBe(404);
  });

  it('hides a pass, brings it back with Voltar a última, and refuses someone not in the deck', async () => {
    await answer(ana, 'dora', false);
    expect((await (await call('/deck', ana)).json()).people).toEqual([]);
    expect(await (await call('/answers/undo', ana, 'POST', {})).json()).toEqual({
      eventIds: [],
      undone: true,
    });
    expect((await (await call('/deck', ana)).json()).people).toHaveLength(1);
    expect((await answer(ana, 'caio', true)).status).toBe(404);
    expect((await answer(ana, 'teen', true)).status).toBe(404);
  });

  it('takes a blocked person out of the deck both ways', async () => {
    await test.db.insert(profileBlocks).values({ blockerId: dora, blockedId: ana });
    expect((await (await call('/deck', ana)).json()).people).toEqual([]);
    expect((await answer(ana, 'dora', true)).status).toBe(404);
    await test.db.delete(profileBlocks);
  });

  it('undoes a match for good, and only one of the two can', async () => {
    const [match] = await test.db.select({ id: matches.id }).from(matches);
    expect((await call(`/${match.id}/end`, caio, 'POST', {})).status).toBe(404);
    const ended = await call(`/${match.id}/end`, bia, 'POST', {});
    expect((await ended.json()).eventIds).toHaveLength(1);
    expect((await (await call('/', ana)).json()).items).toEqual([]);
    expect((await call(`/${match.id}/end`, ana, 'POST', {})).status).toBe(404);
    expect((await call('/not-an-id/end', ana, 'POST', {})).status).toBe(404);
    expect((await (await call('/deck', bia)).json()).people).toEqual([]);
  });

  it('switching off leaves every deck and deletes the answers given', async () => {
    await answer(dora, 'ana', true);
    const off = await call('/card', dora, 'POST', { ...card(['gm']), enabled: false });
    expect((await off.json()).eventIds).toHaveLength(1);
    expect(await test.db.select().from(matchAnswers).where(eq(matchAnswers.fromId, dora))).toEqual(
      [],
    );
    expect(await (await call('/deck', dora)).json()).toEqual({ state: 'off' });
    expect((await (await call('/deck', ana)).json()).people).toEqual([]);
    expect((await (await call('/card', dora)).json()).card).toMatchObject({ enabled: false });
  });

  it('prunes answers older than 180 days', async () => {
    await test.db
      .insert(matchAnswers)
      .values({ fromId: caio, toId: bia, yes: false, createdAt: new Date('2020-01-01') });
    expect(await pruneMatchAnswers(test.db)).toBe(1);
  });
});
