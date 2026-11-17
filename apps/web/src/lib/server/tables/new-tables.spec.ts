import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles, registrations, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { listNewTables } from '@mesaaberta/core/server/tables/queries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const gm = '00000000-0000-4000-8000-000000000611';
const player = '00000000-0000-4000-8000-000000000612';
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const add = async (over: Partial<typeof gameTables.$inferInsert> & { slug: string }) => {
  const [system] = await test.db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.slug, 'daggerheart'));
  const [row] = await test.db
    .insert(gameTables)
    .values({
      title: over.slug,
      kind: 'one_shot',
      capacity: 5,
      startsAt: new Date('2026-10-10T22:00:00Z'),
      durationMinutes: 240,
      timezone: 'America/Sao_Paulo',
      gmId: gm,
      systemId: system.id,
      ...over,
    })
    .returning({ id: gameTables.id });
  return row.id;
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre-bia' },
    { id: player, username: 'jogadore' },
  ]);

  await add({ slug: 'yesterday', publishedAt: daysAgo(1) });
  await add({ slug: 'an-hour-ago', publishedAt: new Date(now.getTime() - 60 * 60 * 1000) });
  await add({ slug: 'last-week', publishedAt: daysAgo(7) });
  await add({ slug: 'too-old', publishedAt: daysAgo(15) });
  await add({ slug: 'draft', status: 'draft', publishedAt: null });
  await add({ slug: 'over', publishedAt: daysAgo(2), startsAt: daysAgo(1) });
  const full = await add({ slug: 'full', capacity: 1, publishedAt: daysAgo(1) });
  await test.db
    .insert(registrations)
    .values({ tableId: full, playerId: player, status: 'confirmed' });
});
afterAll(() => test.close());

describe('listNewTables', () => {
  it('lists the tables published in the last two weeks, the newest first', async () => {
    const slugs = (await listNewTables(test.db, now, 10)).map((t) => t.slug);
    expect(slugs).toEqual(['an-hour-ago', 'yesterday', 'last-week']);
  });

  it('leaves out drafts, full tables, tables that already started and older ones', async () => {
    const slugs = (await listNewTables(test.db, now, 10)).map((t) => t.slug);
    for (const slug of ['draft', 'full', 'over', 'too-old']) expect(slugs).not.toContain(slug);
  });

  it('keeps to the limit', async () => {
    const list = await listNewTables(test.db, now, 2);
    expect(list.map((t) => t.slug)).toEqual(['an-hour-ago', 'yesterday']);
    expect(list[0].publishedAt).toEqual(new Date(now.getTime() - 60 * 60 * 1000));
  });
});
