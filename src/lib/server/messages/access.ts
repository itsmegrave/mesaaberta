import { and, eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  conversationMembers,
  conversations,
  gameTables,
  profiles,
  registrations,
} from '../db/schema';
import type { Actor } from '../auth/policy';

type Conversation = typeof conversations.$inferSelect;

/**
 * Whether the person belongs to the conversation right now. A table chat follows the registrations
 * live (the GM and confirmed players), so a player who leaves or is removed loses it at once; a
 * direct one belongs to its two members.
 */
export async function isMember(db: AnyDb, conversation: Conversation, profileId: string) {
  if (conversation.kind === 'table') {
    const [table] = await db
      .select({ gmId: gameTables.gmId })
      .from(gameTables)
      .where(eq(gameTables.id, conversation.tableId!));
    if (!table) return false;
    if (table.gmId === profileId) return true;

    const [seat] = await db
      .select({ status: registrations.status })
      .from(registrations)
      .where(
        and(
          eq(registrations.tableId, conversation.tableId!),
          eq(registrations.playerId, profileId),
        ),
      );
    return seat?.status === 'confirmed';
  }

  const [member] = await db
    .select({ profileId: conversationMembers.profileId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversation.id),
        eq(conversationMembers.profileId, profileId),
      ),
    );
  return member !== undefined;
}

export const canRead = (db: AnyDb, actor: Actor | null, conversation: Conversation) =>
  actor ? isMember(db, conversation, actor.id) : Promise.resolve(false);

async function otherDirectMember(db: AnyDb, conversationId: string, actorId: string) {
  const rows = await db
    .select({ id: profiles.id, enabled: profiles.directMessagesEnabled, status: profiles.status })
    .from(conversationMembers)
    .innerJoin(profiles, eq(profiles.id, conversationMembers.profileId))
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.find((row) => row.id !== actorId);
}

/**
 * Whether the actor may add a message to the conversation. Suspended accounts never can. A table
 * chat needs the table to be active and the actor to be in it; a direct one needs the actor to be
 * a member and the other person to still take direct messages.
 */
export async function canSend(db: AnyDb, actor: Actor | null, conversation: Conversation) {
  if (!actor || actor.status !== 'active') return false;
  if (!(await isMember(db, conversation, actor.id))) return false;

  if (conversation.kind === 'table') {
    const [table] = await db
      .select({ status: gameTables.status })
      .from(gameTables)
      .where(eq(gameTables.id, conversation.tableId!));
    return table?.status === 'active';
  }

  const other = await otherDirectMember(db, conversation.id, actor.id);
  return other !== undefined && other.enabled && other.status === 'active';
}

/**
 * Whether the actor may start a direct message to `recipientId`, and why not. A person may write to
 * the GM of an active table (before joining too), and a GM may write to anyone with a request or a
 * seat at one of their tables. Either way the recipient must take direct messages.
 */
export async function directBlocker(
  db: AnyDb,
  actor: Actor | null,
  recipientId: string,
): Promise<'forbidden' | 'disabled' | null> {
  if (!actor || actor.status !== 'active' || actor.id === recipientId) return 'forbidden';

  const [recipient] = await db
    .select({ enabled: profiles.directMessagesEnabled, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, recipientId));
  if (!recipient || recipient.status !== 'active') return 'forbidden';

  const [toGm] = await db
    .select({ id: gameTables.id })
    .from(gameTables)
    .where(and(eq(gameTables.gmId, recipientId), eq(gameTables.status, 'active')))
    .limit(1);
  let related = toGm !== undefined;
  if (!related) {
    const [toPlayer] = await db
      .select({ id: gameTables.id })
      .from(gameTables)
      .innerJoin(registrations, eq(registrations.tableId, gameTables.id))
      .where(and(eq(gameTables.gmId, actor.id), eq(registrations.playerId, recipientId)))
      .limit(1);
    related = toPlayer !== undefined;
  }
  if (!related) return 'forbidden';

  return recipient.enabled ? null : 'disabled';
}
