// Relative imports only: `pruneTableChats` runs in the Cron Trigger's Worker, which is bundled
// without SvelteKit's `$lib` alias.
import { and, eq, inArray, lt } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { conversations, gameTables } from '../db/schema';

/** Days a table's chat is kept after the table is disabled. The privacy policy promises this. */
export const TABLE_CHAT_RETENTION_DAYS = 90;

/**
 * Deletes the chats of tables disabled more than `TABLE_CHAT_RETENTION_DAYS` ago, with their
 * messages and members (cascade). Returns how many chats went. Runs in the cron next to
 * `pruneNotifications`.
 */
export async function pruneTableChats(db: AnyDb, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TABLE_CHAT_RETENTION_DAYS * 24 * 3600 * 1000);
  const old = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(gameTables, eq(gameTables.id, conversations.tableId))
    .where(
      and(
        eq(conversations.kind, 'table'),
        eq(gameTables.status, 'disabled'),
        lt(gameTables.updatedAt, cutoff),
      ),
    );
  if (old.length === 0) return 0;

  const ids = old.map((row) => row.id);
  await db.delete(conversations).where(inArray(conversations.id, ids));
  return ids.length;
}
