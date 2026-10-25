import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { userBadges } from '../db/schema';

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
