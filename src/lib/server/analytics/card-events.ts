import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables } from '../db/schema';
import type { StoredEvent } from '../events/types';
import type { AnalyticsEvent } from './provider';

/**
 * The product taxonomy (Trello #155), derived from domain events already in the outbox, so each
 * one keeps its retries and its `insertId` deduplication. Several can come from one domain event:
 * they share its `id`, and Mixpanel tells them apart by event name.
 *
 * Mesas have no draft step today: creating one publishes it, so `TableCreated` is both
 * `gm_mesa_created` and `gm_mesa_published`.
 */
export async function taxonomyEvents(event: StoredEvent, db: AnyDb): Promise<AnalyticsEvent[]> {
  const actorId = event.actorId;
  if (!actorId) return [];
  const base = { distinctId: actorId, insertId: event.id, time: event.createdAt };
  const timestamp_utc = event.createdAt.toISOString();

  switch (event.type) {
    case 'TableCreated': {
      const mesa_id = event.payload.tableId;
      const [table] = await db
        .select({ capacity: gameTables.capacity })
        .from(gameTables)
        .where(eq(gameTables.id, mesa_id));
      return [
        {
          ...base,
          name: 'gm_mesa_created',
          properties: { gm_user_id: actorId, mesa_id, mesa_template: 'blank', timestamp_utc },
        },
        ...(table
          ? [
              {
                ...base,
                name: 'gm_mesa_published',
                properties: {
                  gm_user_id: actorId,
                  mesa_id,
                  seats_initial_count: table.capacity,
                  timestamp_utc,
                },
              },
            ]
          : []),
      ];
    }
    case 'PlayerJoined':
    case 'JoinRequested':
      return [
        {
          ...base,
          name: 'player_seat_claimed',
          properties: {
            mesa_id: event.payload.tableId,
            player_user_id: event.payload.playerId,
            // A table that approves each seat holds the request until its GM decides.
            claim_status: event.type === 'PlayerJoined' ? 'success' : 'pending_approval',
            timestamp_utc,
          },
        },
      ];
    default:
      return [];
  }
}
