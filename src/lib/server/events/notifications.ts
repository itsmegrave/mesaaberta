import { and, eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, notifications, registrations } from '../db/schema';
import {
  NOTIFICATION_KINDS,
  type NotificationType,
  type TableMetadata,
} from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

/** The events that notify someone. `TableCreated` tells nobody new, and `UserSignedIn` is a log. */
type NotifyingEvent = Extract<
  StoredEvent,
  {
    type:
      | 'TableUpdated'
      | 'TableDisabled'
      | 'JoinRequested'
      | 'JoinApproved'
      | 'JoinDeclined'
      | 'PlayerJoined'
      | 'PlayerLeft'
      | 'RatingSubmitted';
  }
>;

type Notice = { to: string[]; type: NotificationType; link: string | null };

async function confirmedPlayers(db: AnyDb, tableId: string): Promise<string[]> {
  const rows = await db
    .select({ id: registrations.playerId })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
  return rows.map((row) => row.id);
}

/** Who hears about an event, and what they are told. Links are unlocalized paths. */
async function noticeFor(db: AnyDb, event: NotifyingEvent, gmId: string): Promise<Notice> {
  const page = `/tables/${event.payload.slug}`;
  const manage = `${page}/manage`;
  switch (event.type) {
    case 'TableUpdated':
      return {
        to: await confirmedPlayers(db, event.payload.tableId),
        type: 'table_updated',
        link: page,
      };
    case 'TableDisabled':
      // The table is off the public pages, so there is nothing to link to.
      return {
        to: await confirmedPlayers(db, event.payload.tableId),
        type: 'table_cancelled',
        link: null,
      };
    case 'JoinRequested':
      return { to: [gmId], type: 'join_requested', link: manage };
    case 'PlayerJoined':
      return { to: [gmId], type: 'player_joined', link: manage };
    case 'JoinApproved':
      return { to: [event.payload.playerId], type: 'join_approved', link: page };
    case 'JoinDeclined':
      return { to: [event.payload.playerId], type: 'join_declined', link: '/tables' };
    case 'PlayerLeft':
      return event.payload.reason === 'removed'
        ? { to: [event.payload.playerId], type: 'player_removed', link: '/tables' }
        : { to: [gmId], type: 'player_left', link: manage };
    case 'RatingSubmitted':
      return { to: [gmId], type: 'rating_received', link: page };
  }
}

/**
 * Writes the bell's notifications for table and registration events. One row per event and
 * recipient (a unique index), so a retry of the same event adds nothing. Nobody is told about what
 * they did themselves.
 */
export const notificationHandler: Handler = {
  name: 'in-app-notifications-v1',
  types: [
    'TableUpdated',
    'TableDisabled',
    'JoinRequested',
    'JoinApproved',
    'JoinDeclined',
    'PlayerJoined',
    'PlayerLeft',
    'RatingSubmitted',
  ],
  async handle(event, db) {
    const notifying = event as NotifyingEvent;
    const [table] = await db
      .select({ gmId: gameTables.gmId, slug: gameTables.slug, title: gameTables.title })
      .from(gameTables)
      .where(eq(gameTables.id, notifying.payload.tableId));
    if (!table) return; // nothing left to tell anyone about

    const notice = await noticeFor(db, notifying, table.gmId);
    const recipients = notice.to.filter((id) => id !== event.actorId);
    if (recipients.length === 0) return;

    const metadata: TableMetadata = {
      tableId: notifying.payload.tableId,
      slug: table.slug,
      title: table.title,
    };
    await db
      .insert(notifications)
      .values(
        recipients.map((recipientId) => ({
          recipientId,
          actorId: event.actorId,
          eventId: event.id,
          category: NOTIFICATION_KINDS[notice.type].category,
          type: notice.type,
          link: notice.link,
          metadata,
          createdAt: event.createdAt,
        })),
      )
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
