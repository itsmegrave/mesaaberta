import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, notifications, profiles, userBadges } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import {
  adminBadgesOf,
  badgeCatalogAdmin,
  grantBadge,
  KNOWN_BADGES,
  revokeBadge,
} from '@mesaaberta/core/server/badges/admin';
import { badgeHandler, badgeNoticeHandler } from '@mesaaberta/core/server/badges/handlers';
import { heldBadges } from '@mesaaberta/core/server/badges/reads';
import { moderationDecisions } from '@mesaaberta/core/server/moderation/decisions';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const [ana, bia, admin] = [
  '00000000-0000-4000-8000-000000007001',
  '00000000-0000-4000-8000-000000007002',
  '00000000-0000-4000-8000-000000007003',
];
const staff = { id: admin, role: 'admin' as const, status: 'active' as const };
const member = { id: bia, role: 'member' as const, status: 'active' as const };
const now = new Date('2026-10-26T12:00:00Z');

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
    { id: admin, username: 'adm', role: 'admin' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(events);
  await test.db.delete(userBadges);
  await test.db.insert(userBadges).values([
    {
      profileId: ana,
      badgeId: 'first-table',
      awardedAt: new Date('2026-10-02T00:00:00Z'),
      sourceEventId: ana,
    },
    { profileId: ana, badgeId: 'pioneer', awardedAt: new Date('2026-10-03T00:00:00Z') },
    { profileId: bia, badgeId: 'first-table', revokedAt: new Date('2026-10-04T00:00:00Z') },
  ]);
});

const eventOf = async (id: string) => {
  const [row] = await test.db.select().from(events).where(eq(events.id, id));
  return row;
};

describe('grantBadge', () => {
  it('gives a manual badge, names the admin and tells the person', async () => {
    const [id] = await grantBadge(
      test.db,
      staff,
      { profileId: ana, badgeId: 'community-helper', reason: 'Ajudou no Discord' },
      now,
    );
    const event = await eventOf(id);
    expect(event).toMatchObject({
      type: 'BadgeGranted',
      actorId: admin,
      payload: { profileId: ana, badgeId: 'community-helper', reason: 'Ajudou no Discord' },
    });
    expect((await heldBadges(test.db, ana)).map((badge) => badge.badgeId)).toContain(
      'community-helper',
    );

    await badgeNoticeHandler.handle(event as unknown as StoredEvent, test.db);
    const [notice] = await test.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, ana));
    expect(notice).toMatchObject({
      type: 'badge_earned',
      metadata: { badgeId: 'community-helper' },
    });
  });

  it('gives back a revoked badge, which a rule never does', async () => {
    await grantBadge(
      test.db,
      staff,
      { profileId: bia, badgeId: 'first-table', reason: 'Engano' },
      now,
    );
    const [row] = await test.db.select().from(userBadges).where(eq(userBadges.profileId, bia));
    expect(row).toMatchObject({
      revokedAt: null,
      revokeReason: null,
      grantedBy: admin,
      awardedAt: now,
    });
  });

  it('refuses a badge held already, a rule badge never held, and an unknown id', async () => {
    const give = (profileId: string, badgeId: string) =>
      grantBadge(test.db, staff, { profileId, badgeId, reason: 'x' }, now);
    await expect(give(ana, 'first-table')).rejects.toEqual(new Invalid('badgeId', 'closed'));
    await expect(give(ana, 'gm-first')).rejects.toEqual(new Invalid('badgeId', 'not_found'));
    await expect(give(ana, 'no-such-badge')).rejects.toEqual(new Invalid('badgeId', 'not_found'));
    expect(await test.db.select().from(events)).toEqual([]);
  });

  it('is for admins only, and only for an account that exists', async () => {
    await expect(
      grantBadge(test.db, member, { profileId: ana, badgeId: 'community-helper', reason: 'x' }),
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(
      grantBadge(test.db, staff, {
        profileId: '00000000-0000-4000-8000-000000007999',
        badgeId: 'community-helper',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFound);
  });
});

describe('revokeBadge', () => {
  it('takes it off the profile with the reason, records it and tells nobody', async () => {
    const [id] = await revokeBadge(
      test.db,
      staff,
      { profileId: ana, badgeId: 'first-table', reason: 'Mesa falsa' },
      now,
    );
    expect(await eventOf(id)).toMatchObject({
      type: 'BadgeRevoked',
      actorId: admin,
      payload: { profileId: ana, badgeId: 'first-table', reason: 'Mesa falsa' },
    });
    expect((await heldBadges(test.db, ana)).map((badge) => badge.badgeId)).toEqual(['pioneer']);
    expect(badgeNoticeHandler.types).not.toContain('BadgeRevoked');
    expect(badgeHandler.types).not.toContain('BadgeRevoked');

    const { held } = await adminBadgesOf(test.db, staff, ana);
    expect(held.find((badge) => badge.badgeId === 'first-table')).toMatchObject({
      revokedAt: now,
      revokeReason: 'Mesa falsa',
    });
  });

  it('refuses a badge the person does not hold', async () => {
    await expect(
      revokeBadge(test.db, staff, { profileId: bia, badgeId: 'first-table', reason: 'x' }),
    ).rejects.toEqual(new Invalid('badgeId', 'not_found'));
  });
});

describe('the admin reads', () => {
  it("counts each badge's holders and revocations, every known badge listed", async () => {
    const catalog = await badgeCatalogAdmin(test.db, staff);
    expect(catalog.map((badge) => badge.badgeId)).toEqual(KNOWN_BADGES.map((b) => b.badgeId));
    expect(catalog.find((badge) => badge.badgeId === 'first-table')).toEqual({
      badgeId: 'first-table',
      kind: 'rule',
      holders: 1,
      revoked: 1,
    });
    expect(catalog.find((badge) => badge.badgeId === 'pioneer')).toMatchObject({
      kind: 'backfill',
      holders: 1,
    });
    expect(catalog.find((badge) => badge.badgeId === 'community-helper')).toMatchObject({
      kind: 'manual',
      holders: 0,
    });
    await expect(badgeCatalogAdmin(test.db, member)).rejects.toBeInstanceOf(Forbidden);
  });

  it("lists a person's badges with where each came from, and what can still be given", async () => {
    await grantBadge(
      test.db,
      staff,
      { profileId: ana, badgeId: 'community-helper', reason: 'x' },
      now,
    );
    const { held, grantable } = await adminBadgesOf(test.db, staff, ana);
    expect(held.map(({ badgeId, source, grantedBy }) => ({ badgeId, source, grantedBy }))).toEqual([
      { badgeId: 'community-helper', source: 'grant', grantedBy: 'adm' },
      { badgeId: 'pioneer', source: 'backfill', grantedBy: null },
      { badgeId: 'first-table', source: 'rule', grantedBy: null },
    ]);
    expect(grantable).toEqual([]);
    expect((await adminBadgesOf(test.db, staff, bia)).grantable).toEqual(['community-helper']);
  });
});

describe('the decisions', () => {
  it('checks the reason and runs the same services for the web and the api', async () => {
    const { schema, apply } = moderationDecisions['badge.grant'];
    expect(
      schema.safeParse({ profileId: ana, badgeId: 'community-helper', reason: '  ' }).success,
    ).toBe(false);
    const data = schema.parse({ profileId: ana, badgeId: 'community-helper', reason: ' Ajudou ' });
    const ids = await apply(test.db, staff, data);
    expect((await eventOf((ids as string[])[0])).payload).toMatchObject({ reason: 'Ajudou' });
    await moderationDecisions['badge.revoke'].apply(test.db, staff, data);
    expect((await heldBadges(test.db, ana)).map((badge) => badge.badgeId)).not.toContain(
      'community-helper',
    );
  });
});
