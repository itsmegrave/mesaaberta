import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { BadgeDecision } from '../../badges/grants';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { profiles, userBadges } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { PIONEER_BADGE } from './backfill';
import { BADGES, MANUAL_BADGES } from './catalog';

/** How a badge is given: by a rule after an event, only by the backfill, or only by an admin. */
export type BadgeKind = 'rule' | 'backfill' | 'manual';

/** Every badge id there is, in the catalog's order, with how it is given. */
export const KNOWN_BADGES: readonly { badgeId: string; kind: BadgeKind }[] = [
  ...BADGES.map((rule) => ({ badgeId: rule.id, kind: 'rule' as const })),
  { badgeId: PIONEER_BADGE, kind: 'backfill' },
  ...MANUAL_BADGES.map((badgeId) => ({ badgeId, kind: 'manual' as const })),
];

const isKnown = (badgeId: string) => KNOWN_BADGES.some((badge) => badge.badgeId === badgeId);

/**
 * `/admin/badges`: every badge with how many people hold it now and how many had it taken away.
 * An id in `user_badges` that the catalog no longer has is left out.
 */
export async function badgeCatalogAdmin(db: AnyDb, actor: Actor | null) {
  authorize(actor, 'moderation:manage');
  const counted = await db
    .select({
      badgeId: userBadges.badgeId,
      holders: sql<number>`count(*) filter (where ${userBadges.revokedAt} is null)`.mapWith(Number),
      revoked: sql<number>`count(*) filter (where ${userBadges.revokedAt} is not null)`.mapWith(
        Number,
      ),
    })
    .from(userBadges)
    .groupBy(userBadges.badgeId);
  const counts = new Map(counted.map((row) => [row.badgeId, row]));
  return KNOWN_BADGES.map((badge) => ({
    ...badge,
    holders: counts.get(badge.badgeId)?.holders ?? 0,
    revoked: counts.get(badge.badgeId)?.revoked ?? 0,
  }));
}

/**
 * The badges on the user's admin page: every one the person has or had, revoked ones included, with
 * who granted it; and the manual badges an admin can still give them.
 */
export async function adminBadgesOf(db: AnyDb, actor: Actor | null, profileId: string) {
  authorize(actor, 'moderation:manage');
  const granter = alias(profiles, 'granter');
  const rows = await db
    .select({
      badgeId: userBadges.badgeId,
      awardedAt: userBadges.awardedAt,
      sourceEventId: userBadges.sourceEventId,
      grantedBy: granter.username,
      grantedById: userBadges.grantedBy,
      revokedAt: userBadges.revokedAt,
      revokeReason: userBadges.revokeReason,
      hidden: userBadges.hidden,
    })
    .from(userBadges)
    .leftJoin(granter, eq(granter.id, userBadges.grantedBy))
    .where(eq(userBadges.profileId, profileId))
    .orderBy(desc(userBadges.awardedAt), asc(userBadges.badgeId));
  const had = new Set(rows.map((row) => row.badgeId));
  return {
    held: rows.map(({ sourceEventId, grantedById, ...row }) => ({
      ...row,
      // A grant names the admin; a rule names its event; the backfill names neither.
      source: grantedById
        ? ('grant' as const)
        : sourceEventId
          ? ('rule' as const)
          : ('backfill' as const),
    })),
    grantable: MANUAL_BADGES.filter((badgeId) => !had.has(badgeId)),
  };
}

/** The person a badge goes to: an account that is there and finished signing up. */
async function lockHolder(db: AnyDb, profileId: string) {
  const [person] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), isNotNull(profiles.username)))
    .for('update');
  if (!person) throw new NotFound('no such profile');
}

/**
 * An admin gives a badge: a manual one the person does not have, or one taken away earlier, given
 * back. It records `BadgeGranted`, which puts the badge's notice in their bell.
 */
export async function grantBadge(
  db: AnyDb,
  actor: Actor | null,
  { profileId, badgeId, reason }: BadgeDecision,
  now = new Date(),
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  if (!isKnown(badgeId)) throw new Invalid('badgeId', 'not_found');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await lockHolder(t, profileId);
    const [row] = await t
      .select({ revokedAt: userBadges.revokedAt })
      .from(userBadges)
      .where(and(eq(userBadges.profileId, profileId), eq(userBadges.badgeId, badgeId)));
    if (row && !row.revokedAt) throw new Invalid('badgeId', 'closed');
    if (row) {
      await t
        .update(userBadges)
        .set({ revokedAt: null, revokeReason: null, grantedBy: actor!.id, awardedAt: now })
        .where(and(eq(userBadges.profileId, profileId), eq(userBadges.badgeId, badgeId)));
    } else {
      // Only a manual badge is given from nothing: the others come from their rule.
      if (!MANUAL_BADGES.includes(badgeId)) throw new Invalid('badgeId', 'not_found');
      await t
        .insert(userBadges)
        .values({ profileId, badgeId, awardedAt: now, grantedBy: actor!.id });
    }
    return [
      await recordEvent(t, {
        type: 'BadgeGranted',
        actorId: actor!.id,
        payload: { profileId, badgeId, reason },
      }),
    ];
  });
}

/**
 * An admin takes a badge away. The row stays, revoked with the reason, so no rule gives it again;
 * only a grant does. The person is not told.
 */
export async function revokeBadge(
  db: AnyDb,
  actor: Actor | null,
  { profileId, badgeId, reason }: BadgeDecision,
  now = new Date(),
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await lockHolder(t, profileId);
    const revoked = await t
      .update(userBadges)
      .set({ revokedAt: now, revokeReason: reason })
      .where(
        and(
          eq(userBadges.profileId, profileId),
          eq(userBadges.badgeId, badgeId),
          isNull(userBadges.revokedAt),
        ),
      )
      .returning({ id: userBadges.badgeId });
    if (revoked.length === 0) throw new Invalid('badgeId', 'not_found');
    return [
      await recordEvent(t, {
        type: 'BadgeRevoked',
        actorId: actor!.id,
        payload: { profileId, badgeId, reason },
      }),
    ];
  });
}
