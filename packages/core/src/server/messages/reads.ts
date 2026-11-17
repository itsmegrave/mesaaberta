import { and, eq, ne } from 'drizzle-orm';
import { gameTables, registrations } from '../db/schema';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { NotFound } from '../errors';
import {
  addTableMember,
  ensureTableConversation,
  listMessages,
  loadConversation,
  markConversationRead,
} from './service';

/**
 * An open thread (`/m/[id]`) for a member: the header, the newest messages, and everything read up
 * to now. `about` is the slug of the table a direct message started from (`?mesa=`), shown as its
 * context; a draft is nobody's business but its GM's, so its title is not shown either. Throws
 * `NotFound` for anyone else.
 */
export async function openThread(
  db: AnyDb,
  actor: Actor | null,
  conversationId: string,
  about: string | null,
) {
  const conversation = await loadConversation(db, actor, conversationId);
  const thread = await listMessages(db, actor, conversationId);
  await markConversationRead(db, actor, conversationId);

  const [context] =
    about && conversation.kind === 'direct'
      ? await db
          .select({ id: gameTables.id, slug: gameTables.slug, title: gameTables.title })
          .from(gameTables)
          .where(and(eq(gameTables.slug, about), ne(gameTables.status, 'draft')))
      : [];
  return {
    conversation,
    messages: thread.messages,
    hasMore: thread.hasMore,
    context: context ?? null,
  };
}

/**
 * Opens a table's chat for its GM and confirmed players: makes the conversation on first use and
 * makes sure they are in it. Anyone else gets `NotFound`, as if there were no chat.
 */
export async function openTableChat(db: AnyDb, actor: Actor | null, slug: string) {
  if (!actor) throw new NotFound('no such table');
  const [table] = await db
    .select({ id: gameTables.id, gmId: gameTables.gmId })
    .from(gameTables)
    .where(eq(gameTables.slug, slug));
  if (!table) throw new NotFound('no such table');

  const [seat] = await db
    .select({ status: registrations.status })
    .from(registrations)
    .where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, actor.id)));
  if (table.gmId !== actor.id && seat?.status !== 'confirmed') throw new NotFound('no such table');

  await addTableMember(db, table.id, actor.id);
  return { conversationId: (await ensureTableConversation(db, table.id)).id };
}
