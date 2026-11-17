import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { profiles, userBadges } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { badgeProgress, heldBadges, setBadgeHidden } from '@mesaaberta/core/server/badges/reads';
import { publicProfile } from '@mesaaberta/core/server/profile/public';

let test: Awaited<ReturnType<typeof createTestDb>>;
const [ana, admin] = [
  '00000000-0000-4000-8000-000000006001',
  '00000000-0000-4000-8000-000000006002',
];

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: admin, username: 'adm', role: 'admin' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(userBadges);
  await test.db.insert(userBadges).values([
    {
      profileId: ana,
      badgeId: 'first-table',
      awardedAt: new Date('2026-10-02T00:00:00Z'),
      sourceEventId: ana,
    },
    {
      profileId: ana,
      badgeId: 'partner',
      awardedAt: new Date('2026-10-01T00:00:00Z'),
      hidden: true,
      sourceEventId: ana,
    },
    { profileId: ana, badgeId: 'pioneer', awardedAt: new Date('2026-10-03T00:00:00Z') },
    {
      profileId: ana,
      badgeId: 'gm-first',
      revokedAt: new Date('2026-10-04T00:00:00Z'),
      revokeReason: 'abuse',
      sourceEventId: ana,
    },
  ]);
});

describe('heldBadges', () => {
  it('lists the newest first, without revoked or hidden ones, and marks a backfill', async () => {
    expect(await heldBadges(test.db, ana)).toEqual([
      expect.objectContaining({ badgeId: 'pioneer', backfilled: true }),
      expect.objectContaining({ badgeId: 'first-table', backfilled: false }),
    ]);
  });

  it('gives the owner the hidden ones too', async () => {
    const all = await heldBadges(test.db, ana, { includeHidden: true });
    expect(all.map((badge) => badge.badgeId)).toEqual(['pioneer', 'first-table', 'partner']);
    expect(all.find((badge) => badge.badgeId === 'partner')?.hidden).toBe(true);
  });
});

describe('publicProfile badges', () => {
  it('has none when the rollout has not reached the profile', async () => {
    expect((await publicProfile(test.db, 'ana'))!.badges).toBeNull();
    expect(
      (await publicProfile(test.db, 'ana', { showBadges: async () => false }))!.badges,
    ).toBeNull();
  });

  it('hands the rollout the profile and its role, and shows hidden badges to the owner only', async () => {
    const asked: unknown[] = [];
    const showBadges = async (target: { id: string; isAdmin: boolean }) => {
      asked.push(target);
      return true;
    };

    const visitor = await publicProfile(test.db, 'ana', { showBadges });
    const owner = await publicProfile(test.db, 'ana', { showBadges, viewerId: ana });
    await publicProfile(test.db, 'adm', { showBadges });

    expect(visitor!.badges!.map((badge) => badge.badgeId)).toEqual(['pioneer', 'first-table']);
    expect(owner!.badges!.map((badge) => badge.badgeId)).toEqual([
      'pioneer',
      'first-table',
      'partner',
    ]);
    expect(asked).toEqual([
      { id: ana, isAdmin: false },
      { id: ana, isAdmin: false },
      { id: admin, isAdmin: true },
    ]);
  });
});

describe('badgeProgress', () => {
  it('offers the next rung of each ladder and the single badges, never one already held or revoked', async () => {
    await test.db.delete(userBadges);
    await test.db.insert(userBadges).values([
      { profileId: ana, badgeId: 'regular-player-1' },
      { profileId: ana, badgeId: 'gm-first', revokedAt: new Date(), revokeReason: 'abuse' },
    ]);

    const progress = await badgeProgress(test.db, ana);
    const ids = progress.map((entry) => entry.badgeId);

    expect(ids).toContain('regular-player-2');
    expect(ids).not.toContain('regular-player-1');
    expect(ids).not.toContain('regular-player-3');
    expect(ids).toContain('gm-master-1');
    expect(ids).not.toContain('gm-master-2');
    expect(ids).not.toContain('gm-first');
    expect(progress.find((entry) => entry.badgeId === 'regular-player-2')).toEqual({
      badgeId: 'regular-player-2',
      current: 0,
      goal: 25,
    });
  });
});

describe('setBadgeHidden', () => {
  it('hides and shows a held badge, and refuses one the person does not hold', async () => {
    await test.db.delete(userBadges);
    await test.db.insert(userBadges).values({ profileId: ana, badgeId: 'first-table' });

    expect(await setBadgeHidden(test.db, ana, 'first-table', true)).toBe(true);
    expect(await heldBadges(test.db, ana)).toEqual([]);
    expect(await setBadgeHidden(test.db, ana, 'first-table', false)).toBe(true);
    expect(await heldBadges(test.db, ana)).toHaveLength(1);
    expect(await setBadgeHidden(test.db, ana, 'partner', true)).toBe(false);
    expect(await setBadgeHidden(test.db, admin, 'first-table', true)).toBe(false);
  });
});
