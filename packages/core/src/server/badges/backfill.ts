import { and, asc, eq, gt, isNotNull } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles, userBadges } from '../db/schema';
import { BADGES, meets, statsFor } from './catalog';

/** Given only by a backfill, to who joined before the feature was released. */
export const PIONEER_BADGE = 'pioneer';

export type BackfillSummary = {
  /** Members looked at: active accounts that finished onboarding. */
  members: number;
  /** How many members got each badge in this run (a dry run: would get it). */
  awarded: Record<string, number>;
};

const BATCH = 200;

/**
 * Gives existing members the badges their history already earned. It records no `BadgeEarned`
 * event, so nobody is notified. A held or revoked badge is left as it is, so it is safe to run
 * again. `apply: false` only counts. `pioneerBefore` also gives the Pioneiro to who joined before
 * that time; leave it out to give none.
 */
export async function backfillBadges(
  db: AnyDb,
  { apply, pioneerBefore, now = new Date() }: { apply: boolean; pioneerBefore?: Date; now?: Date },
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { members: 0, awarded: {} };
  const count = (badgeId: string) =>
    (summary.awarded[badgeId] = (summary.awarded[badgeId] ?? 0) + 1);
  let after: string | null = null;

  for (;;) {
    const batch: { id: string; createdAt: Date }[] = await db
      .select({ id: profiles.id, createdAt: profiles.createdAt })
      .from(profiles)
      .where(
        and(
          eq(profiles.status, 'active'),
          isNotNull(profiles.username),
          after ? gt(profiles.id, after) : undefined,
        ),
      )
      .orderBy(asc(profiles.id))
      .limit(BATCH);
    if (batch.length === 0) break;
    after = batch[batch.length - 1].id;

    for (const member of batch) {
      summary.members += 1;
      const held = new Set(
        (
          await db
            .select({ id: userBadges.badgeId })
            .from(userBadges)
            .where(eq(userBadges.profileId, member.id))
        ).map((row) => row.id),
      );
      const stats = statsFor(db, member.id);
      const due: string[] = [];
      for (const rule of BADGES)
        if (!held.has(rule.id) && (await meets(rule, stats))) due.push(rule.id);
      if (pioneerBefore && member.createdAt < pioneerBefore && !held.has(PIONEER_BADGE))
        due.push(PIONEER_BADGE);

      for (const badgeId of due) {
        if (apply) {
          const inserted = await db
            .insert(userBadges)
            .values({ profileId: member.id, badgeId, awardedAt: now })
            .onConflictDoNothing()
            .returning({ id: userBadges.badgeId });
          if (inserted.length === 0) continue;
        }
        count(badgeId);
      }
    }
  }
  return summary;
}
