import { and, eq, sql } from 'drizzle-orm';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { conversations, events, gameTables, registrations } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { lockTableSchedule } from './schedule-guard';

/** Owner actions: acquire the schedule lock before the table lock, like publish and duplicate. */
async function lockedOwnedTable(db: AnyDb, actor: Actor | null, slug: string) {
  const [found] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!found) throw new NotFound();
  authorize(actor, 'table:end', found);
  await lockTableSchedule(db, found.gmId);
  const [table] = await db
    .select()
    .from(gameTables)
    .where(eq(gameTables.id, found.id))
    .for('update');
  if (!table) throw new NotFound();
  authorize(actor, 'table:end', table);
  return table;
}

/** Destroy only a still-private draft. Cascade catalog links and chat content; keep minimal audit. */
export async function deleteDraftTable(db: AnyDb, actor: Actor | null, slug: string) {
  return db.transaction(async (tx) => {
    const transaction = tx as unknown as AnyDb;
    const table = await lockedOwnedTable(transaction, actor, slug);
    if (table.status !== 'draft') throw new Invalid('slug', 'not_a_draft');
    await tx.delete(registrations).where(eq(registrations.tableId, table.id));
    await tx.delete(conversations).where(eq(conversations.tableId, table.id));
    await tx.delete(gameTables).where(eq(gameTables.id, table.id));
    // Completed historical rows are audit-only: erase the draft's content, but retain who/when,
    // type and table ID for retention and creation-limit accounting. No handler may replay them.
    await tx
      .update(events)
      .set({
        payload: { tableId: table.id },
        processedAt: new Date(),
        lastError: null,
        claimedUntil: null,
        claimToken: null,
      })
      .where(eq(sql`${events.payload}->>'tableId'`, table.id));
    // Images can be shared by copies. Storage has no reference-aware garbage collector yet, so
    // retain the object rather than race a concurrent copy or delete another table's image.
    const eventId = await recordEvent(transaction, {
      type: 'TableDraftDeleted',
      actorId: actor!.id,
      payload: { tableId: table.id },
    });
    return { eventIds: [eventId], slug };
  });
}

/**
 * End future participation without deleting session history. TableDisabled is the single outbox
 * cancellation contract: calendar and membership notices are idempotent per event. Keep confirmed
 * registrations as the recipient/history snapshot; pending requests no longer reserve participation.
 * Invitation integration must cancel pending invitations under this same row lock before commit.
 */
export async function closeTable(db: AnyDb, actor: Actor | null, slug: string) {
  return db.transaction(async (tx) => {
    const transaction = tx as unknown as AnyDb;
    const table = await lockedOwnedTable(transaction, actor, slug);
    if (table.status === 'disabled') return { eventIds: [], slug };
    if (table.status !== 'active' && table.status !== 'awaiting_confirmation') {
      throw new Invalid('slug', 'table_not_active');
    }
    await tx
      .update(gameTables)
      .set({ status: 'disabled', icalSequence: table.icalSequence + 1 })
      .where(eq(gameTables.id, table.id));
    const cancelledRequests = await tx
      .delete(registrations)
      .where(and(eq(registrations.tableId, table.id), eq(registrations.status, 'pending')))
      .returning({ playerId: registrations.playerId });
    const eventId = await recordEvent(transaction, {
      type: 'TableDisabled',
      actorId: actor!.id,
      payload: {
        tableId: table.id,
        slug,
        title: table.title,
        cancelledRequestPlayerIds: cancelledRequests.map((request) => request.playerId),
      },
    });
    return { eventIds: [eventId], slug };
  });
}
