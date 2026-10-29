import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { notifications, placeHostInvitations, placePartnerLinks, places } from '../db/schema';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type LinkEvent = Extract<
  StoredEvent,
  { type: 'PlacePartnerLinkApproved' | 'PlacePartnerLinkRejected' | 'PlacePartnerUnlinked' }
>;
type HostEvent = Extract<
  StoredEvent,
  {
    type:
      | 'PlaceHostInvited'
      | 'PlaceHostInvitationAccepted'
      | 'PlaceHostInvitationDeclined'
      | 'PlaceHostRemoved';
  }
>;
const HOST_TYPES = [
  'PlaceHostInvited',
  'PlaceHostInvitationAccepted',
  'PlaceHostInvitationDeclined',
  'PlaceHostRemoved',
] as const satisfies readonly HostEvent['type'][];
const isHostEvent = (event: StoredEvent): event is HostEvent =>
  (HOST_TYPES as readonly string[]).includes(event.type);

/** The invite, while it still waits and its place is up: a stale outbox entry tells nobody. */
async function waitingInvitation(db: AnyDb, id: string, now = new Date()) {
  const [row] = await db
    .select({
      status: placeHostInvitations.status,
      expiresAt: placeHostInvitations.expiresAt,
      removedAt: places.removedAt,
    })
    .from(placeHostInvitations)
    .innerJoin(places, eq(places.id, placeHostInvitations.placeId))
    .where(eq(placeHostInvitations.id, id));
  return !!row && row.status === 'pending' && row.expiresAt > now && !row.removedAt;
}

/** Who hears of a house GM event, and what: null when nobody does. */
async function hostRow(db: AnyDb, item: HostEvent) {
  const { placeId, slug, name } = item.payload;
  const metadata = { placeId, place: name };
  if (item.type === 'PlaceHostInvited') {
    if (!(await waitingInvitation(db, item.payload.invitationId))) return null;
    return {
      recipientId: item.payload.inviteeId,
      type: 'place_host_invited' as NotificationType,
      link: `/pp/${slug}/house/${item.payload.invitationId}`,
      metadata,
    };
  }
  if (item.type === 'PlaceHostRemoved') {
    // Taken off by the owner or an admin: the person hears of it. Left on their own ("Sair"): the
    // place's owner does, when it has one.
    if (item.actorId !== item.payload.profileId)
      return {
        recipientId: item.payload.profileId,
        type: 'place_host_removed' as NotificationType,
        link: null,
        metadata,
      };
    const [place] = await db
      .select({ ownerId: places.ownerId })
      .from(places)
      .where(eq(places.id, placeId));
    if (!place?.ownerId) return null;
    return {
      recipientId: place.ownerId,
      type: 'place_host_removed' as NotificationType,
      link: `/pp/${slug}/edit`,
      metadata: { ...metadata, left: '1' },
    };
  }
  return {
    recipientId: item.payload.inviterId,
    type: (item.type === 'PlaceHostInvitationAccepted'
      ? 'place_host_invitation_accepted'
      : 'place_host_invitation_declined') as NotificationType,
    link: `/pp/${slug}/edit`,
    metadata,
  };
}

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
 * The bell for the links between directory pages. Whoever asked to show a place as a partner's
 * hears whether an admin approved or rejected it (with the admin's note), and that the link came
 * down when someone else took it down. For "Quem mestra na casa", the invited person hears of the
 * invite (linked to its page), whoever invited hears the answer (linked to the edit page) and a
 * house GM taken off is told; leaving, a cancelled and a lapsed invite tell nobody. Nobody is told
 * about what they did themselves. One row per event and recipient, so a retry adds nothing.
 */
export const directoryLinkHandler: Handler = {
  name: 'directory-link-notifications-v1',
  types: [
    'PlacePartnerLinkApproved',
    'PlacePartnerLinkRejected',
    'PlacePartnerUnlinked',
    ...HOST_TYPES,
  ],
  async handle(event, db: AnyDb) {
    if (isHostEvent(event)) {
      const row = await hostRow(db, event);
      if (!row || row.recipientId === event.actorId) return;
      await db
        .insert(notifications)
        .values({
          ...row,
          actorId: event.actorId,
          eventId: event.id,
          category: NOTIFICATION_KINDS[row.type].category,
          createdAt: event.createdAt,
        })
        .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
      return;
    }
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
