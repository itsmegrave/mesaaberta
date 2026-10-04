import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  gameTables,
  profiles,
  profileSocialLinks,
  ratings,
  registrations,
  systems,
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { publicProfile } from './public';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date('2026-10-01T12:00:00Z');
const read = (username = 'mestre-ana', page = 1, viewerId: string | null = null) =>
  publicProfile(test.db, username, {
    page,
    now,
    viewerId,
    supabaseUrl: 'https://example.supabase.co',
  });

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    {
      id: id(1),
      username: 'mestre-ana',
      name: 'Private civil name',
      city: 'Private city',
      ageRange: '25_34',
      gender: 'other',
      genderOther: 'Private gender',
      role: 'admin',
      directMessagesEnabled: false,
      avatarPath: 'uploaded.png',
      avatarUrl: 'https://cdn.discordapp.com/provider.png',
      banReason: 'Private moderation',
    },
    { id: id(2), username: 'jogador-bia' },
    { id: id(3), username: 'outro-mestre' },
    { id: id(4), username: 'suspenso', status: 'suspended' },
    { id: id(5), username: null, status: 'suspended' },
    { id: id(6), username: 'sem-mesas' },
    { id: id(7), username: 'foto-provedor', avatarUrl: 'https://cdn.discordapp.com/provider.png' },
    { id: id(8), username: null },
  ]);
  await test.db.insert(profileSocialLinks).values([
    { profileId: id(1), network: 'website', url: 'https://example.com', position: 2 },
    { profileId: id(1), network: 'instagram', url: 'https://instagram.com/ana', position: 0 },
    { profileId: id(1), network: 'github', url: 'javascript:alert(1)', position: 1 },
    { profileId: id(1), network: 'unknown', url: 'https://example.com', position: 3 },
    { profileId: id(1), network: 'x', url: 'https://secret:password@x.com/ana', position: 4 },
  ]);
  const [system] = await test.db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.slug, 'daggerheart'));
  const add = async (slug: string, over: Partial<typeof gameTables.$inferInsert> = {}) => {
    const [table] = await test.db
      .insert(gameTables)
      .values({
        slug,
        title: slug,
        systemId: system.id,
        gmId: id(1),
        kind: 'one_shot',
        capacity: 5,
        startsAt: new Date('2026-10-08T18:00:00Z'),
        durationMinutes: 180,
        timezone: 'America/Sao_Paulo',
        joinDetails: 'Private join link',
        welcomeMessage: 'Private welcome',
        moderationNote: 'Private table moderation',
        ...over,
      })
      .returning({ id: gameTables.id });
    return table.id;
  };
  for (let n = 0; n < 14; n++) {
    const tableId = await add(`future-${String(n).padStart(2, '0')}`, {
      startsAt: new Date(Date.UTC(2026, 9, 5 + Math.floor(n / 2), 18)),
    });
    if (n === 0)
      await test.db.insert(registrations).values([
        { tableId, playerId: id(2), status: 'confirmed' },
        { tableId, playerId: id(6), status: 'pending' },
      ]);
  }
  await add('recurring', {
    kind: 'campaign',
    recurrence: 'FREQ=WEEKLY',
    startsAt: new Date('2026-09-05T21:00:00Z'),
  });
  await add('expired', {
    kind: 'campaign',
    recurrence: 'FREQ=WEEKLY',
    startsAt: new Date('2026-09-05T21:00:00Z'),
    until: new Date('2026-09-20T21:00:00Z'),
  });
  await add('already-started', { startsAt: new Date('2026-10-01T11:00:00Z') });
  await add('other-gm', { gmId: id(3) });
  for (const status of ['disabled', 'awaiting_confirmation', 'not_held'] as const)
    await add(status, { status });
  const done = await add('done-one', {
    status: 'concluded',
    startsAt: new Date('2026-09-01T18:00:00Z'),
  });
  const second = await add('done-two', { status: 'concluded' });
  await add('done-campaign', { status: 'concluded', kind: 'campaign', recurrence: 'FREQ=WEEKLY' });
  await test.db.insert(registrations).values([
    { tableId: done, playerId: id(2), status: 'confirmed' },
    { tableId: done, playerId: id(6), status: 'confirmed' },
    { tableId: done, playerId: id(1), status: 'confirmed' },
    { tableId: second, playerId: id(2), status: 'pending' },
  ]);
  await test.db.insert(ratings).values([
    { tableId: done, playerId: id(2), gmScore: 5, comment: 'Private rating comment' },
    { tableId: done, playerId: id(6), gmScore: 3 },
  ]);
  for (const status of [
    'concluded',
    'not_held',
    'awaiting_confirmation',
    'active',
    'disabled',
  ] as const) {
    const tableId = await add(`private-played-history-${status}`, { gmId: id(3), status });
    await test.db.insert(registrations).values({ tableId, playerId: id(1), status: 'confirmed' });
  }
});
afterAll(() => test.close());

describe('public profiles', () => {
  it('returns only the allowlisted identity, aggregates and public cards', async () => {
    const data = (await read())!;
    expect(Object.keys(data.profile).sort()).toEqual([
      'avatarUrl',
      'links',
      'rating',
      'totals',
      'username',
    ]);
    expect(Object.keys(data.tables[0]).sort()).toEqual([
      'capacity',
      'gmName',
      'gmRating',
      'imageUrl',
      'kind',
      'locationArea',
      'modality',
      'nextAt',
      'platforms',
      'seatsLeft',
      'slug',
      'system',
      'tags',
      'timezone',
      'title',
    ]);
    const serialized = JSON.stringify(data);
    for (const secret of [
      'Private',
      'private-played-history',
      'avatarPath',
      'directMessagesEnabled',
      'gender',
      'banReason',
      'registrations',
      'gmId',
      'joinDetails',
      'welcomeMessage',
      'moderationNote',
      'comment',
    ])
      expect(serialized).not.toContain(secret);
  });

  it('reads only safe known social links in the saved order', async () => {
    expect((await read())?.profile.links).toEqual([
      { network: 'instagram', text: '@ana', href: 'https://instagram.com/ana' },
      { network: 'website', text: 'example.com', href: 'https://example.com/' },
    ]);
  });

  it('uses the uploaded picture before the provider, then the provider, then a placeholder', async () => {
    expect((await read())?.profile.avatarUrl).toBe(
      'https://example.supabase.co/storage/v1/object/public/profile-avatars/uploaded.png',
    );
    expect((await read('foto-provedor'))?.profile.avatarUrl).toBe(
      'https://cdn.discordapp.com/provider.png',
    );
    expect((await read('sem-mesas'))?.profile.avatarUrl).toBeNull();
  });

  it('has an empty state for a person who has never run a table', async () => {
    expect(await read('sem-mesas')).toMatchObject({
      profile: { totals: { played: 1, hosted: 0 }, rating: { score: null, count: 0, isNew: true } },
      tables: [],
      total: 0,
      pages: 1,
    });
    expect((await read('foto-provedor'))?.profile.totals).toEqual({ played: 0, hosted: 0 });
  });

  it.each([
    'missing',
    'suspenso',
    'null',
    'messages',
    'notifications',
    'maintenance',
    'instagram',
    'changelog',
    'bad_name',
  ])('does not expose unavailable or reserved profile %s', async (username) => {
    expect(await read(username)).toBeNull();
  });

  it('accepts capitalization and exposes only the canonical username', async () => {
    expect((await read('MESTRE-ANA'))?.profile.username).toBe('mestre-ana');
  });

  it('offers edit only to the actual owner', async () => {
    expect((await read())?.isOwner).toBe(false);
    expect((await read('mestre-ana', 1, id(2)))?.isOwner).toBe(false);
    expect((await read('mestre-ana', 1, id(1)))?.isOwner).toBe(true);
  });

  it('counts concluded tables once, with confirmed seats, excluding the GM from players', async () => {
    expect((await read())?.profile.totals).toEqual({ played: 1, hosted: 3 });
    expect((await read('jogador-bia'))?.profile.totals).toEqual({ played: 1, hosted: 0 });
  });

  it('uses the GM score and keeps unreviewed profiles distinct from zero', async () => {
    expect((await read())?.profile.rating).toEqual({ score: 4, count: 2, isNew: true });
    expect((await read('foto-provedor'))?.profile.rating).toEqual({
      score: null,
      count: 0,
      isNew: true,
    });
  });

  it('paginates the right GM after recurrence calculation, with deterministic ordering and seats', async () => {
    const first = (await read())!;
    const second = (await read('mestre-ana', 2))!;
    expect(first).toMatchObject({ total: 15, pages: 2, page: 1 });
    expect(first.tables).toHaveLength(12);
    expect(first.tables[0]).toMatchObject({
      slug: 'recurring',
      nextAt: new Date('2026-10-03T21:00:00Z'),
    });
    expect(first.tables[1]).toMatchObject({ slug: 'future-00', seatsLeft: 4 });
    expect(first.tables[2].slug).toBe('future-01');
    expect(second.tables.map((t) => t.slug)).toEqual(['future-11', 'future-12', 'future-13']);
    expect(new Set([...first.tables, ...second.tables].map((t) => t.slug)).size).toBe(15);
  });

  it('immediately reflects rename and suspension without serving an old public projection', async () => {
    await test.db
      .update(profiles)
      .set({ username: 'novo-username' })
      .where(eq(profiles.id, id(7)));
    expect(await read('foto-provedor')).toBeNull();
    expect((await read('novo-username'))?.profile.username).toBe('novo-username');
    await test.db
      .update(profiles)
      .set({ status: 'suspended' })
      .where(eq(profiles.id, id(7)));
    expect(await read('novo-username')).toBeNull();
  });
});
