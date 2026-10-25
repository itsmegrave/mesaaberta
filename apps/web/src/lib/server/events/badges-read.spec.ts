import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { profiles, userBadges } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { heldBadges } from '@mesaaberta/core/server/badges/reads';
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
