import { activeAdmins } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { notifications, profiles } from '../db/schema';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type PlaceAlertEvent = Extract<StoredEvent, { type: 'PlaceHidden' | 'PlaceRestored' }>;

const keepersOf = ({ submitterId, ownerId }: PlaceAlertEvent['payload']) => [
  ...new Set([submitterId, ...(ownerId ? [ownerId] : [])]),
];

/**
 * The bell when reports hide an "Onde jogar" place, and when an admin puts it back. Hiding raises
 * the high alert (`place_hidden_alert`) for every active admin, linked to the reported places, and
 * a neutral notice for whoever sent it and its owner; restoring tells those two. Nobody is told who
 * reported, so no notice names an actor. One row per event and recipient, so a retry adds nothing.
 */
export const placeAlertHandler: Handler = {
  name: 'place-alert-notifications-v1',
  types: ['PlaceHidden', 'PlaceRestored'],
  async handle(event, db: AnyDb) {
    const item = event as PlaceAlertEvent;
    const { placeId, slug, name } = item.payload;
    const keepers = keepersOf(item.payload).filter((id) => id !== event.actorId);
    type Row = {
      recipientId: string;
      type: NotificationType;
      link: string | null;
      metadata: Record<string, string>;
    };
    const rows: Row[] = keepers.map((recipientId): Row => ({
      recipientId,
      type: 'moderation_notice',
      link: item.type === 'PlaceRestored' ? `/pp/${slug}` : null,
      metadata:
        item.type === 'PlaceHidden'
          ? { placeId, placeHidden: name }
          : { placeId, placeRestored: name },
    }));
    if (item.type === 'PlaceHidden') {
      const admins = await db.select({ id: profiles.id }).from(profiles).where(activeAdmins());
      for (const admin of admins)
        if (!keepers.includes(admin.id))
          rows.push({
            recipientId: admin.id,
            type: 'place_hidden_alert',
            link: '/admin/places?status=reported',
            metadata: { placeId, place: name, reportId: item.payload.reportId },
          });
    }
    if (rows.length === 0) return;
    await db
      .insert(notifications)
      .values(
        rows.map((row) => ({
          ...row,
          actorId: null,
          eventId: event.id,
          category: NOTIFICATION_KINDS[row.type].category,
          createdAt: event.createdAt,
        })),
      )
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
