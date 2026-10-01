import { eq } from 'drizzle-orm';
import { activeAdmins } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { gameTables, notifications, profiles } from '../db/schema';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type ModerationEvent = Extract<
  StoredEvent,
  { type: 'ReportFiled' | 'ReportResolved' | 'ReportDismissed' | 'TableClosedByModeration' }
>;

async function recipientsOf(db: AnyDb, event: ModerationEvent) {
  if (event.type === 'TableClosedByModeration') {
    const [table] = await db
      .select({ gmId: gameTables.gmId })
      .from(gameTables)
      .where(eq(gameTables.id, event.payload.tableId));
    return table ? [table.gmId] : [];
  }
  if (event.type !== 'ReportFiled') return [event.payload.reporterId];
  const admins = await db.select({ id: profiles.id }).from(profiles).where(activeAdmins());
  return admins.map((admin) => admin.id);
}

/**
 * The bell for moderation: a new report reaches every active admin (linked to it in the queue), the
 * reporter hears when it is closed (never what was done or by whom), and a GM whose table an admin
 * closed is told, with no link: a disabled table is a 404. One row per event and
 * recipient, so a retry adds nothing. Nobody is told about what they did themselves.
 */
export const moderationHandler: Handler = {
  name: 'moderation-notifications-v1',
  types: ['ReportFiled', 'ReportResolved', 'ReportDismissed', 'TableClosedByModeration'],
  async handle(event, db) {
    const moderation = event as ModerationEvent;
    const type: NotificationType =
      moderation.type === 'ReportFiled'
        ? 'report_filed_admin'
        : moderation.type === 'TableClosedByModeration'
          ? 'moderation_notice'
          : 'report_resolved';
    const recipients = (await recipientsOf(db, moderation)).filter((id) => id !== event.actorId);
    if (recipients.length === 0) return;

    const reportId = moderation.payload.reportId;
    await db
      .insert(notifications)
      .values(
        recipients.map((recipientId) => ({
          recipientId,
          // The reporter is never named, not even to an admin's bell: the queue shows who it was.
          actorId: null,
          eventId: event.id,
          category: NOTIFICATION_KINDS[type].category,
          type,
          link: type === 'report_filed_admin' ? `/admin/reports/${reportId}` : null,
          metadata:
            moderation.type === 'TableClosedByModeration'
              ? {
                  reportId,
                  tableId: moderation.payload.tableId,
                  slug: moderation.payload.slug,
                  title: moderation.payload.title,
                }
              : { reportId },
          createdAt: event.createdAt,
        })),
      )
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
