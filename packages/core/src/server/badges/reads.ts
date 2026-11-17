import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { userBadges } from '../db/schema';
import { statsFor } from './catalog';
import { ruleBadges } from './rules';

export type HeldBadge = {
  badgeId: string;
  awardedAt: Date;
  hidden: boolean;
  /** Given by the backfill, so `awardedAt` is the run's time and not when it was earned. */
  backfilled: boolean;
};

/**
 * The badges a person holds now: revoked ones are gone. A visitor does not see the ones the owner
 * hid (`includeHidden: false`); the owner sees all, with `hidden` set.
 */
export async function heldBadges(
  db: AnyDb,
  profileId: string,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Promise<HeldBadge[]> {
  const rows = await db
    .select({
      badgeId: userBadges.badgeId,
      awardedAt: userBadges.awardedAt,
      hidden: userBadges.hidden,
      sourceEventId: userBadges.sourceEventId,
      grantedBy: userBadges.grantedBy,
    })
    .from(userBadges)
    .where(
      and(
        eq(userBadges.profileId, profileId),
        isNull(userBadges.revokedAt),
        includeHidden ? undefined : eq(userBadges.hidden, false),
      ),
    )
    .orderBy(desc(userBadges.awardedAt), asc(userBadges.badgeId));
  return rows.map((row) => ({
    badgeId: row.badgeId,
    awardedAt: row.awardedAt,
    hidden: row.hidden,
    backfilled: row.sourceEventId === null && row.grantedBy === null,
  }));
}

export type BadgeProgress = { badgeId: string; current: number; goal: number };

/**
 * How far along the person is toward the badges they do not have, for their own view: the next
 * rung of each ladder and every single badge. A revoked badge is not offered again.
 */
export async function badgeProgress(db: AnyDb, profileId: string): Promise<BadgeProgress[]> {
  const have = new Set(
    (
      await db
        .select({ id: userBadges.badgeId })
        .from(userBadges)
        .where(eq(userBadges.profileId, profileId))
    ).map((row) => row.id),
  );
  const stats = statsFor(db, profileId);
  const rules = ruleBadges();
  const next = rules.filter(
    (rule) =>
      !rule.unlisted &&
      !have.has(rule.id) &&
      !rules.some(
        (other) =>
          other.ladder === rule.ladder &&
          other.ladder !== undefined &&
          (other.tier ?? 0) < (rule.tier ?? 0) &&
          !have.has(other.id),
      ),
  );
  return Promise.all(
    next.map(async (rule) => ({
      badgeId: rule.id,
      current: Math.min(await rule.measure(stats), rule.goal),
      goal: rule.goal,
    })),
  );
}

/** The owner hides a badge from their profile, or shows it again. False when they do not hold it. */
export async function setBadgeHidden(
  db: AnyDb,
  profileId: string,
  badgeId: string,
  hidden: boolean,
): Promise<boolean> {
  const changed = await db
    .update(userBadges)
    .set({ hidden })
    .where(
      and(
        eq(userBadges.profileId, profileId),
        eq(userBadges.badgeId, badgeId),
        isNull(userBadges.revokedAt),
      ),
    )
    .returning({ id: userBadges.badgeId });
  return changed.length > 0;
}

/** The GM's badges the table page can show beside the handle, the strongest first. */
export const GM_BADGE_ORDER = [
  'beloved-gm',
  'gm-master-3',
  'word-kept',
  'gm-master-2',
  'full-table',
  'open-door',
  'wandering-gm',
  'gm-master-1',
  'gm-first',
] as const;

/**
 * The badges on a table's roster: the GM's strongest GM badge (`GM_BADGE_ORDER`), and which of the
 * given players hold "Presença confiável". Only what the holder shows: revoked and hidden ones are
 * left out, as on the profile.
 */
export async function rosterBadges(
  db: AnyDb,
  gmId: string,
  playerIds: readonly string[],
): Promise<{ gm: string | null; reliable: string[] }> {
  const shown = and(isNull(userBadges.revokedAt), eq(userBadges.hidden, false));
  const [gmHeld, reliable] = await Promise.all([
    db
      .select({ badgeId: userBadges.badgeId })
      .from(userBadges)
      .where(
        and(
          eq(userBadges.profileId, gmId),
          inArray(userBadges.badgeId, [...GM_BADGE_ORDER]),
          shown,
        ),
      ),
    playerIds.length
      ? db
          .select({ profileId: userBadges.profileId })
          .from(userBadges)
          .where(
            and(
              inArray(userBadges.profileId, [...playerIds]),
              eq(userBadges.badgeId, 'reliable-player'),
              shown,
            ),
          )
      : [],
  ]);
  const held = new Set(gmHeld.map((row) => row.badgeId));
  return {
    gm: GM_BADGE_ORDER.find((badgeId) => held.has(badgeId)) ?? null,
    reliable: reliable.map((row) => row.profileId),
  };
}
