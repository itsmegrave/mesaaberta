import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { matches, notifications, profiles } from '../db/schema';
import { routes } from '../../routes';
import { NOTIFICATION_KINDS } from '../../notifications/kinds';
import type { Handler } from './types';

/**
 * Combinar's bell (bell only, never e-mail): when two people both said yes, each hears "@x também
 * quer jogar com você", linking to the matches list. Nobody hears about a match already undone, or
 * from or about a suspended account. Only `use_matchmaking` lets anyone answer, so with it off
 * there is nobody to tell.
 */
export const matchesHandler: Handler = {
  name: 'matches-v1',
  types: ['MatchCreated'],
  async handle(event, db: AnyDb) {
    if (event.type !== 'MatchCreated') return;
    const [match] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.id, event.payload.matchId), isNull(matches.endedAt)));
    if (!match) return;
    const people = await db
      .select({ id: profiles.id, username: profiles.username, status: profiles.status })
      .from(profiles)
      .where(inArray(profiles.id, event.payload.profileIds));
    if (people.length !== 2 || people.some((p) => p.status !== 'active' || !p.username)) return;
    const [a, b] = people;
    await db
      .insert(notifications)
      .values(
        [
          [a, b],
          [b, a],
        ].map(([recipient, other]) => ({
          recipientId: recipient.id,
          actorId: other.id,
          eventId: event.id,
          category: NOTIFICATION_KINDS.match_created.category,
          type: 'match_created',
          link: routes.matchList,
          metadata: { matchId: match.id },
          createdAt: event.createdAt,
        })),
      )
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
