import { and, eq } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  conversationMembers,
  conversations,
  gameTables,
  profiles,
  registrations,
} from '@mesaaberta/core/server/db/schema';
import { can, type Actor } from '@mesaaberta/core/server/auth/policy';
import { firstSessionEnded } from '../ratings/service';
import { blockState } from '../blocks/service';
import type { TableStatus } from '../../tables/status-values';
import { TABLE_CHAT_DAYS_AFTER_END } from '../../messages/schema';

type Conversation = typeof conversations.$inferSelect;

/**
 * Whether a table's chat takes new messages at `now`: `open` until `TABLE_CHAT_DAYS_AFTER_END` days
 * after the session ended (whatever the GM answered about it), `ended` after that, and `disabled`
 * for a cancelled or moderated table (or a draft, which has no players), which never takes them.
 */
export function tableChatState(
  table: { status: TableStatus; startsAt: Date; durationMinutes: number },
  now: Date,
): 'open' | 'ended' | 'disabled' {
  if (table.status === 'disabled' || table.status === 'draft') return 'disabled';
  const windowStart = new Date(now.getTime() - TABLE_CHAT_DAYS_AFTER_END * 24 * 3600 * 1000);
  return firstSessionEnded(table, windowStart) ? 'ended' : 'open';
}

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
 * chat needs the actor to be in it and the chat to be open (`tableChatState`); a direct one needs
 * the actor to be a member and the other person to still take direct messages.
 */
export async function canSend(
  db: AnyDb,
  actor: Actor | null,
  conversation: Conversation,
  now = new Date(),
) {
  if (!actor || actor.status !== 'active') return false;
  if (!(await isMember(db, conversation, actor.id))) return false;

  if (conversation.kind === 'table') {
    const [table] = await db
      .select({
        status: gameTables.status,
        startsAt: gameTables.startsAt,
        durationMinutes: gameTables.durationMinutes,
      })
      .from(gameTables)
      .where(eq(gameTables.id, conversation.tableId!));
    return table !== undefined && tableChatState(table, now) === 'open';
  }

  const other = await otherDirectMember(db, conversation.id, actor.id);
  if (other === undefined || !other.enabled || other.status !== 'active') return false;
  // An admin still reaches someone who blocked them: moderation must get through.
  if (can(actor, 'moderation:manage')) return true;
  const block = await blockState(db, actor.id, other.id);
  return !block.mine && !block.theirs;
}

/**
 * Whether the actor may start a direct message to `recipientId`, and why not. A person may write to
 * the GM of an active table (before joining too), a GM may write to anyone with a request or a
 * seat at one of their tables, and an admin may write to anyone. Either way the recipient must take
 * direct messages. Someone the recipient blocked reads `disabled`, as if direct messages were off;
 * someone the actor blocked reads `blocked`, so the actor is offered to unblock them.
 */
export async function directBlocker(
  db: AnyDb,
  actor: Actor | null,
  recipientId: string,
): Promise<'forbidden' | 'disabled' | 'blocked' | null> {
  if (!actor || actor.status !== 'active' || actor.id === recipientId) return 'forbidden';

  const [recipient] = await db
    .select({ enabled: profiles.directMessagesEnabled, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, recipientId));
  if (!recipient || recipient.status !== 'active') return 'forbidden';

  // An admin may write to anyone (from the user's page in admin), if they take direct messages.
  if (can(actor, 'moderation:manage')) return recipient.enabled ? null : 'disabled';

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

  const block = await blockState(db, actor.id, recipientId);
  if (block.mine) return 'blocked';
  return recipient.enabled && !block.theirs ? null : 'disabled';
}
