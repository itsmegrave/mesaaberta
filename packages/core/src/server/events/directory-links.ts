import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { notifications, placePartnerLinks } from '../db/schema';
import { NOTIFICATION_KINDS } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type LinkEvent = Extract<
  StoredEvent,
  { type: 'PlacePartnerLinkApproved' | 'PlacePartnerLinkRejected' | 'PlacePartnerUnlinked' }
>;

/** What the requester is told, or null when the event says nothing to them. */
async function metadataOf(db: AnyDb, item: LinkEvent): Promise<Record<string, string>> {
  const { placeId, name, partnerName } = item.payload;
  const base = { placeId, place: name, partner: partnerName };
  if (item.type === 'PlacePartnerLinkApproved') return { ...base, placePartnerApproved: name };
  if (item.type === 'PlacePartnerUnlinked') return { ...base, placePartnerRemoved: name };
  const [link] = await db
    .select({ note: placePartnerLinks.decisionNote })
    .from(placePartnerLinks)
    .where(eq(placePartnerLinks.id, item.payload.linkId));
  return { ...base, placePartnerRejected: name, ...(link?.note ? { note: link.note } : {}) };
}

/**
 * The bell for the links between directory pages: whoever asked to show a place as a partner's
 * hears whether an admin approved or rejected it (with the admin's note), and that the link came
 * down when someone else took it down. Nobody is told about what they did themselves. One row per
 * event and recipient, so a retry adds nothing. A new handler name, because `handledBy` stores it.
 */
export const directoryLinkHandler: Handler = {
  name: 'directory-link-notifications-v1',
  types: ['PlacePartnerLinkApproved', 'PlacePartnerLinkRejected', 'PlacePartnerUnlinked'],
  async handle(event, db: AnyDb) {
    const item = event as LinkEvent;
    const recipientId = item.payload.requestedBy;
    if (!recipientId || recipientId === event.actorId) return;
    await db
      .insert(notifications)
      .values({
        recipientId,
        type: 'moderation_notice',
        link: item.type === 'PlacePartnerLinkRejected' ? null : `/pp/${item.payload.slug}`,
        metadata: await metadataOf(db, item),
        actorId: null,
        eventId: event.id,
        category: NOTIFICATION_KINDS.moderation_notice.category,
        createdAt: event.createdAt,
      })
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
