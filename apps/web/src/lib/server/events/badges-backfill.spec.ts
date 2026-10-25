import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  notifications,
  profiles,
  registrations,
  systems,
  userBadges,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { backfillBadges } from '@mesaaberta/core/server/badges/backfill';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000050${String(n).padStart(2, '0')}`;
const [gm, player, absent, closed] = [id(1), id(2), id(3), id(4)];
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestra', createdAt: new Date('2026-01-01T00:00:00Z') },
    { id: player, username: 'jogadora', createdAt: new Date('2026-09-01T00:00:00Z') },
    { id: absent, username: 'ausente', createdAt: new Date('2026-10-20T00:00:00Z') },
    { id: closed, username: null, status: 'suspended' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `backfill-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 5,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: gm,
      systemId: system.id,
      status: 'concluded',
    })
    .returning();
  await test.db.insert(registrations).values([
    { tableId: table.id, playerId: player, status: 'confirmed' },
    { tableId: table.id, playerId: absent, status: 'confirmed', attended: false },
    { tableId: table.id, playerId: closed, status: 'confirmed' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(userBadges);
});

const held = async (profileId: string) =>
  (await test.db.select().from(userBadges).where(eq(userBadges.profileId, profileId)))
    .map((row) => row.badgeId)
    .sort();

describe('backfillBadges', () => {
  it('only counts on a dry run', async () => {
    const summary = await backfillBadges(test.db, { apply: false });

    expect(summary).toEqual({
      members: 3,
      awarded: { 'first-100': 3, 'first-table': 1, 'gm-first': 1 },
    });
    expect(await test.db.select().from(userBadges)).toEqual([]);
  });

  it('awards from history, skipping the absent and closed accounts, and tells nobody', async () => {
    const summary = await backfillBadges(test.db, { apply: true });

    expect(summary.awarded).toEqual({ 'first-100': 3, 'first-table': 1, 'gm-first': 1 });
    expect(await held(player)).toEqual(['first-100', 'first-table']);
    expect(await held(gm)).toEqual(['first-100', 'gm-first']);
    // Early members all get the Primeira centena; the absent one played nothing, so only that.
    expect(await held(absent)).toEqual(['first-100']);
    expect(await held(closed)).toEqual([]);
    expect(await test.db.select().from(events)).toEqual([]);
    expect(await test.db.select().from(notifications)).toEqual([]);
    const [row] = await test.db.select().from(userBadges).where(eq(userBadges.profileId, player));
    expect(row.sourceEventId).toBeNull();
  });

  it('gives the Pioneiro to who joined before the date, and only when asked', async () => {
    await backfillBadges(test.db, { apply: true, pioneerBefore: new Date('2026-10-01T00:00:00Z') });

    expect(await held(gm)).toEqual(['first-100', 'gm-first', 'pioneer']);
    expect(await held(player)).toEqual(['first-100', 'first-table', 'pioneer']);
    expect(await held(absent)).toEqual(['first-100']);
  });

  it('is safe to run again and leaves a revoked badge revoked', async () => {
    await backfillBadges(test.db, { apply: true });
    await test.db
      .update(userBadges)
      .set({ revokedAt: new Date(), revokeReason: 'abuse' })
      .where(eq(userBadges.profileId, player));

    const again = await backfillBadges(test.db, { apply: true });

    expect(again.awarded).toEqual({});
    expect(
      (await test.db.select().from(userBadges).where(eq(userBadges.profileId, player)))[0]
        .revokedAt,
    ).not.toBeNull();
  });
});
