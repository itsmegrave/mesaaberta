import { eq } from 'drizzle-orm';
import { activeAdmins } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { notifications, placeClaims, profiles } from '../db/schema';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type PlaceAlertEvent = Extract<
  StoredEvent,
  {
    type:
      | 'PlaceHidden'
      | 'PlaceRestored'
      | 'PlaceClaimApproved'
      | 'PlaceClaimRejected'
      | 'PlaceOwnerRemoved';
  }
>;

type Row = {
  recipientId: string;
  type: NotificationType;
  link: string | null;
  metadata: Record<string, string>;
};

/** Who hears of the event, and what each is told. */
async function rowsOf(db: AnyDb, item: PlaceAlertEvent): Promise<Row[]> {
  const { placeId, slug, name } = item.payload;
  const notice = (recipientId: string, metadata: Record<string, string>, link: string | null) => ({
    recipientId,
    type: 'moderation_notice' as const,
    link,
    metadata: { placeId, ...metadata },
  });

  if (item.type === 'PlaceClaimApproved')
    return [notice(item.payload.claimantId, { placeClaimApproved: name }, `/pp/${slug}`)];
  if (item.type === 'PlaceClaimRejected') {
    const [claim] = await db
      .select({ note: placeClaims.decisionNote })
      .from(placeClaims)
      .where(eq(placeClaims.id, item.payload.claimId));
    return [
      notice(
        item.payload.claimantId,
        { placeClaimRejected: name, ...(claim?.note ? { note: claim.note } : {}) },
        null,
      ),
    ];
  }
  if (item.type === 'PlaceOwnerRemoved')
    return [notice(item.payload.profileId, { placeOwnerRemoved: name }, `/pp/${slug}`)];

  const { submitterId, ownerId } = item.payload;
  const keepers = [...new Set([submitterId, ...(ownerId ? [ownerId] : [])])];
  const rows: Row[] = keepers.map((recipientId) =>
    item.type === 'PlaceHidden'
      ? notice(recipientId, { placeHidden: name }, null)
      : notice(recipientId, { placeRestored: name }, `/pp/${slug}`),
  );
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
  return rows;
}

/**
 * The bell for "Onde jogar" places. Reports hiding a place raise the high alert
 * (`place_hidden_alert`) for every active admin, linked to the reported places, and a neutral
 * notice for whoever sent it and its owner; restoring it tells those two. A claimant hears whether
 * their claim was approved or rejected (with the admin's note), and an owner an admin took off is
 * told. Nobody is told who reported, so no notice names an actor, and nobody is told about what
 * they did themselves. One row per event and recipient, so a retry adds nothing.
 */
export const placeAlertHandler: Handler = {
  name: 'place-alert-notifications-v1',
  types: [
    'PlaceHidden',
    'PlaceRestored',
    'PlaceClaimApproved',
    'PlaceClaimRejected',
    'PlaceOwnerRemoved',
  ],
  async handle(event, db: AnyDb) {
    const item = event as PlaceAlertEvent;
    const rows = (await rowsOf(db, item)).filter(
      // A hidden place's alert reaches an admin who reported it too; the rest skip their actor.
      (row) => item.type === 'PlaceHidden' || row.recipientId !== event.actorId,
    );
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
