// Relative imports only, and nothing from SvelteKit: the Cron Trigger's Worker bundles this file
// (through the announcement handler) without Vite.
import { and, count, eq, exists, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, notifications, profiles, registrations } from '../db/schema';
import type { StoredEvent } from '../events/types';
import type { AnnouncementAudience } from '../../notifications/kinds';

/**
 * The profiles an announcement goes to. Every audience is limited to active accounts, so a
 * suspended one hears nothing, even when named on its own.
 */
export function audienceWhere(audience: AnnouncementAudience, recipientId: string | null): SQL {
  const active = eq(profiles.status, 'active');
  switch (audience) {
    case 'all_active_users':
      return active;
    case 'game_masters':
      // Anyone who has opened a table, disabled or not.
      return and(
        active,
        exists(sql`(select 1 from ${gameTables} where ${gameTables.gmId} = ${profiles.id})`),
      )!;
    case 'active_players':
      return and(
        active,
        exists(
          sql`(select 1 from ${registrations} where ${registrations.playerId} = ${profiles.id} and ${registrations.status} = 'confirmed')`,
        ),
      )!;
    case 'specific_user':
      // No recipient matches nobody, never everyone.
      return and(active, recipientId ? eq(profiles.id, recipientId) : sql`false`)!;
  }
}

/** How many active people an audience reaches right now. */
export async function countAudience(
  db: AnyDb,
  audience: AnnouncementAudience,
  recipientId: string | null = null,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(profiles)
    .where(audienceWhere(audience, recipientId));
  return row?.total ?? 0;
}

/**
 * Writes an announcement into the bell of everyone in its audience, in one statement however large
 * the audience is. Each row carries the event's id, so the unique (event, recipient) index makes a
 * retry add nothing: it is safe to run any number of times.
 */
export async function deliverAnnouncement(
  db: AnyDb,
  event: Extract<StoredEvent, { type: 'SystemAnnouncementSent' }>,
): Promise<void> {
  const { payload } = event;
  await db
    .insert(notifications)
    .select(
      db
        .select({
          id: sql`gen_random_uuid()`.as('id'),
          recipientId: profiles.id,
          // From the platform, not from a person: the admin is kept in the event.
          actorId: sql`null`.as('actor_id'),
          eventId: sql`${event.id}::uuid`.as('event_id'),
          category: sql`'system'::notification_category`.as('category'),
          type: sql`'system_announcement'`.as('type'),
          icon: sql`${payload.icon}`.as('icon'),
          title: sql`${payload.title}`.as('title'),
          body: sql`${payload.body}`.as('body'),
          link: sql`${payload.link}`.as('link'),
          metadata: sql`${JSON.stringify({ tone: payload.tone })}::jsonb`.as('metadata'),
          readAt: sql`null`.as('read_at'),
          createdAt: sql`${event.createdAt.toISOString()}::timestamptz`.as('created_at'),
        })
        .from(profiles)
        .where(audienceWhere(payload.audience, payload.recipientId)),
    )
    .onConflictDoNothing();
}
