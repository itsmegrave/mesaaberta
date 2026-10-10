import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { notifications, platforms, tags } from '../db/schema';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

type CatalogEvent = Extract<
  StoredEvent,
  { type: 'CatalogEntryApproved' | 'CatalogEntryRejected' | 'CatalogEntryMerged' }
>;

const TYPES: Record<CatalogEvent['type'], NotificationType> = {
  CatalogEntryApproved: 'catalog_suggestion_approved',
  CatalogEntryRejected: 'catalog_suggestion_rejected',
  CatalogEntryMerged: 'catalog_suggestion_merged',
};

/**
 * The bell for the catalog: the person who suggested a platform or a tag hears when an admin
 * approves it, turns it down or folds it into one that already existed. One row per event, so a
 * retry adds nothing. An admin is never told about their own decision, and an entry of the catalog
 * itself (no one suggested it) tells nobody.
 */
export const catalogHandler: Handler = {
  name: 'catalog-notifications-v1',
  types: ['CatalogEntryApproved', 'CatalogEntryRejected', 'CatalogEntryMerged'],
  async handle(event, db: AnyDb) {
    const decision = event as CatalogEvent;
    const table = decision.payload.kind === 'platform' ? platforms : tags;
    const [entry] = await db
      .select({ suggestedBy: table.suggestedBy })
      .from(table)
      .where(eq(table.id, decision.payload.entryId));
    const recipient = entry?.suggestedBy;
    if (!recipient || recipient === event.actorId) return;

    const type = TYPES[decision.type];
    await db
      .insert(notifications)
      .values({
        recipientId: recipient,
        actorId: null,
        eventId: event.id,
        category: NOTIFICATION_KINDS[type].category,
        type,
        link: null,
        metadata: {
          kind: decision.payload.kind,
          name: decision.payload.name,
          ...(decision.type === 'CatalogEntryMerged' ? { into: decision.payload.into } : {}),
        },
        createdAt: event.createdAt,
      })
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
