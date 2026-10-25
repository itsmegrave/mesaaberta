import { and, eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, notifications, profiles, registrations, userBadges } from '../db/schema';
import { routes } from '../../routes';
import { recordEvent } from '../events/outbox';
import type { Handler, StoredEvent } from '../events/types';
import { BADGES, statsFor, type BadgeDefinition } from './catalog';

/** Who an event may have earned a badge for. */
async function candidates(db: AnyDb, event: StoredEvent): Promise<string[]> {
  switch (event.type) {
    case 'TableConcluded': {
      const [table] = await db
        .select({ gmId: gameTables.gmId })
        .from(gameTables)
        .where(eq(gameTables.id, event.payload.tableId));
      if (!table) return [];
      const players = await db
        .select({ id: registrations.playerId })
        .from(registrations)
        .where(
          and(
            eq(registrations.tableId, event.payload.tableId),
            eq(registrations.status, 'confirmed'),
          ),
        );
      // The ones marked absent did not take part: their count is re-checked by the rule itself.
      return [...new Set([table.gmId, ...players.map((row) => row.id)])];
    }
    case 'RatingSubmitted':
      return [event.payload.playerId];
    case 'PartnerApproved':
      return [event.payload.submitterId];
    default:
      return [];
  }
}

/** Awards what `profileId` now qualifies for, and records `BadgeEarned` for each new one. */
export async function awardBadges(
  db: AnyDb,
  profileId: string,
  rules: readonly BadgeDefinition[],
  event: Pick<StoredEvent, 'id' | 'createdAt'>,
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const executor = tx as unknown as AnyDb;
    // A badge already held (or revoked: a revocation is never undone by a rule) is left alone.
    const held = new Set(
      (
        await executor
          .select({ id: userBadges.badgeId })
          .from(userBadges)
          .where(eq(userBadges.profileId, profileId))
      ).map((row) => row.id),
    );
    const stats = statsFor(executor, profileId);
    const earned: string[] = [];
    for (const rule of rules) {
      if (held.has(rule.id) || !(await rule.check(stats))) continue;
      const inserted = await executor
        .insert(userBadges)
        .values({
          profileId,
          badgeId: rule.id,
          awardedAt: event.createdAt,
          sourceEventId: event.id,
        })
        .onConflictDoNothing()
        .returning({ id: userBadges.badgeId });
      if (inserted.length === 0) continue;
      earned.push(rule.id);
      await recordEvent(executor, {
        type: 'BadgeEarned',
        actorId: null,
        payload: { profileId, badgeId: rule.id },
      });
    }
    return earned;
  });
}

/**
 * Awards the badges an event can have earned. Idempotent: a badge is a row keyed by person and
 * badge, so a retry awards nothing twice and a revoked badge stays revoked.
 */
export const badgeHandler: Handler = {
  name: 'badges-v1',
  types: ['TableConcluded', 'RatingSubmitted', 'PartnerApproved'],
  async handle(event, db) {
    const rules = BADGES.filter((rule) => rule.triggers.includes(event.type));
    if (rules.length === 0) return;
    for (const profileId of await candidates(db, event)) {
      await awardBadges(db, profileId, rules, event);
    }
  },
};

/** The bell notice for a badge a rule awarded. A backfill records no event, so it tells nobody. */
export const badgeNoticeHandler: Handler = {
  name: 'badge-notice-v1',
  types: ['BadgeEarned'],
  async handle(event, db) {
    if (event.type !== 'BadgeEarned') return;
    const [person] = await db
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, event.payload.profileId));
    if (!person) return;
    await db
      .insert(notifications)
      .values({
        recipientId: event.payload.profileId,
        actorId: null,
        eventId: event.id,
        category: 'achievements',
        type: 'badge_earned',
        link: person.username ? `${routes.profile(person.username)}#conquistas` : null,
        metadata: { badgeId: event.payload.badgeId },
        createdAt: event.createdAt,
      })
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
