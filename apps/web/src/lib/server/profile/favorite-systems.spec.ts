import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import {
  events,
  profileFavoriteSystems,
  profiles,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { Invalid } from '@mesaaberta/core/server/errors';
import { mergeEntry } from '@mesaaberta/core/server/admin/catalog';
import {
  readFavoriteSystems,
  setFavoriteSystems,
} from '@mesaaberta/core/server/profile/favorite-systems';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;
const ana = id(1);
const bia = id(2);
const admin = { id: id(3), role: 'admin' as const, status: 'active' as const };
let seeded: { id: string; slug: string; name: string }[] = [];

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
    { id: admin.id, username: 'admin', role: 'admin' },
  ]);
  seeded = await test.db
    .select({ id: systems.id, slug: systems.slug, name: systems.name })
    .from(systems)
    .where(eq(systems.status, 'approved'))
    .orderBy(asc(systems.position), asc(systems.name))
    .limit(12);
  await test.db.insert(systems).values({
    id: id(50),
    name: 'Sistema em análise',
    slug: 'sistema-em-analise',
    status: 'pending',
  });
});
afterAll(() => test.close());

const slugs = (n: number, from = 0) => seeded.slice(from, from + n).map((system) => system.slug);

describe('favorite systems', () => {
  it('saves the systems and the switch, reads them back most played first, and records the event', async () => {
    const picked = [seeded[2].slug, seeded[0].slug];
    const { eventIds } = await setFavoriteSystems(test.db, ana, { systems: picked, show: false });

    expect((await readFavoriteSystems(test.db, ana)).map((s) => s.slug)).toEqual([
      seeded[0].slug,
      seeded[2].slug,
    ]);
    const [profile] = await test.db.select().from(profiles).where(eq(profiles.id, ana));
    expect(profile.showFavoriteSystems).toBe(false);
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({ type: 'FavoriteSystemsChanged', actorId: ana });
    expect((event.payload as { systemIds: string[] }).systemIds.sort()).toEqual(
      [seeded[0].id, seeded[2].id].sort(),
    );
  });

  it('replaces the whole list, and an empty one clears it', async () => {
    await setFavoriteSystems(test.db, ana, { systems: slugs(3, 4), show: true });
    expect((await readFavoriteSystems(test.db, ana)).map((s) => s.slug)).toEqual(slugs(3, 4));

    await setFavoriteSystems(test.db, ana, { systems: [], show: true });
    expect(await readFavoriteSystems(test.db, ana)).toEqual([]);
  });

  it('refuses more than ten, or a system that is not approved, and keeps what was saved', async () => {
    await setFavoriteSystems(test.db, bia, { systems: slugs(2), show: true });

    await expect(
      setFavoriteSystems(test.db, bia, { systems: slugs(11), show: true }),
    ).rejects.toMatchObject({ field: 'systems', message: 'too_many' });
    await expect(
      setFavoriteSystems(test.db, bia, { systems: ['sistema-em-analise'], show: true }),
    ).rejects.toBeInstanceOf(Invalid);
    await expect(
      setFavoriteSystems(test.db, bia, { systems: ['nao-existe'], show: true }),
    ).rejects.toMatchObject({ message: 'unknown' });

    expect((await readFavoriteSystems(test.db, bia)).map((s) => s.slug)).toEqual(slugs(2));
  });

  it('counts a slug sent twice once', async () => {
    await setFavoriteSystems(test.db, bia, {
      systems: [seeded[0].slug, seeded[0].slug],
      show: true,
    });
    expect(await readFavoriteSystems(test.db, bia)).toHaveLength(1);
  });

  it('moves favorites to the surviving system when an admin merges a duplicate, once', async () => {
    await test.db.insert(systems).values({ id: id(60), name: 'Duplicado', slug: 'duplicado' });
    const target = seeded[1];
    await test.db.delete(profileFavoriteSystems);
    await test.db.insert(profileFavoriteSystems).values([
      { profileId: ana, systemId: id(60) },
      { profileId: bia, systemId: id(60) },
      { profileId: bia, systemId: target.id },
    ]);

    await mergeEntry(test.db, admin, 'system', id(60), target.id);

    const rows = await test.db.select().from(profileFavoriteSystems);
    expect(rows.map((row) => [row.profileId, row.systemId]).sort()).toEqual(
      [
        [ana, target.id],
        [bia, target.id],
      ].sort(),
    );
  });
});
