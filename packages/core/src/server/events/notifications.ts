import { routes } from '../../routes';
import { and, eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, notifications, ratings, registrations } from '../db/schema';
import {
  NOTIFICATION_KINDS,
  TABLE_NOTICE_FIELDS,
  type NotificationType,
  type TableMetadata,
} from '../../notifications/kinds';
import type { Changes, Handler, StoredEvent } from './types';

/** The events that notify someone. `TableCreated` tells nobody new, and `UserSignedIn` is a log. */
type NotifyingEvent = Extract<
  StoredEvent,
  {
    type:
      | 'TableUpdated'
      | 'TableDisabled'
      | 'TableAwaitingConfirmation'
      | 'TableConcluded'
      | 'RatingsOpened'
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
  const page = routes.table(event.payload.slug);
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
        to: [
          ...new Set([
            ...(await confirmedPlayers(db, event.payload.tableId)),
            ...(event.payload.cancelledRequestPlayerIds ?? []),
          ]),
        ],
        type: 'table_cancelled',
        link: null,
      };
    case 'TableAwaitingConfirmation':
      return { to: [gmId], type: 'session_confirmation', link: manage };
    case 'TableConcluded': {
      // Whoever the GM marked absent is not asked to rate, nor whoever already did (a table that
      // went on lets players rate before it ends).
      const absent = new Set(event.payload.absentPlayerIds ?? []);
      const rated = new Set(
        (
          await db
            .select({ id: ratings.playerId })
            .from(ratings)
            .where(eq(ratings.tableId, event.payload.tableId))
        ).map((row) => row.id),
      );
      return {
        to: (await confirmedPlayers(db, event.payload.tableId)).filter(
          (id) => !absent.has(id) && !rated.has(id),
        ),
        type: 'rating_prompt',
        link: page,
      };
    }
    case 'RatingsOpened':
      return { to: event.payload.playerIds, type: 'rating_prompt', link: page };
    case 'JoinRequested':
      return { to: [gmId], type: 'join_requested', link: manage };
    case 'PlayerJoined':
      return { to: [gmId], type: 'player_joined', link: manage };
    case 'JoinApproved':
      return { to: [event.payload.playerId], type: 'join_approved', link: page };
    case 'JoinDeclined':
      return { to: [event.payload.playerId], type: 'join_declined', link: routes.tables };
    case 'PlayerLeft':
      return event.payload.reason === 'removed'
        ? { to: [event.payload.playerId], type: 'player_removed', link: routes.tables }
        : { to: [gmId], type: 'player_left', link: manage };
    case 'RatingSubmitted':
      return { to: [gmId], type: 'rating_received', link: page };
  }
}

/**
 * What a change notice says changed: the player-facing fields, and the old and new start when it
 * moved. A redacted field (the join details) is named, never its value.
 */
export function changeSummary(
  changes: Changes | undefined,
): Pick<TableMetadata, 'changed' | 'startsAtFrom' | 'startsAtTo'> {
  if (!changes) return {};
  const fields = TABLE_NOTICE_FIELDS.filter((field) => Object.hasOwn(changes, field));
  const start = changes.startsAt;
  const moved =
    start && 'from' in start && typeof start.from === 'string' && typeof start.to === 'string'
      ? { startsAtFrom: start.from, startsAtTo: start.to }
      : {};
  return { ...(fields.length > 0 ? { changed: fields.join(',') } : {}), ...moved };
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
    'TableAwaitingConfirmation',
    'TableConcluded',
    'RatingsOpened',
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
      .select({
        gmId: gameTables.gmId,
        slug: gameTables.slug,
        title: gameTables.title,
        status: gameTables.status,
      })
      .from(gameTables)
      .where(eq(gameTables.id, notifying.payload.tableId));
    if (!table) return; // nothing left to tell anyone about
    // A queued request/update can arrive after closure. Its cancellation already tells people
    // what remains true; never send a stale approval or session prompt after that.
    if (
      table.status === 'disabled' &&
      [
        'TableUpdated',
        'TableAwaitingConfirmation',
        'JoinRequested',
        'JoinApproved',
        'PlayerJoined',
      ].includes(notifying.type)
    )
      return;

    const notice = await noticeFor(db, notifying, table.gmId);
    const recipients = notice.to.filter((id) => id !== event.actorId);
    if (recipients.length === 0) return;

    const metadata: TableMetadata = {
      tableId: notifying.payload.tableId,
      slug: table.slug,
      title: table.title,
      ...(notifying.type === 'TableUpdated' ? changeSummary(notifying.payload.changes) : {}),
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
