import { and, count, desc, eq, gt, inArray, isNull, lte, lt, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  conversationMembers,
  conversations,
  gameTables,
  messages,
  notifications,
  profiles,
} from '../db/schema';
import { publicName } from '../db/public-name';
import type { Actor } from '../auth/policy';
import { DirectMessagesOff, Forbidden, NotFound, RateLimited } from '../errors';
import { INBOX_PAGE_SIZE, THREAD_PAGE_SIZE, pairKey } from '../../messages/schema';
import { canRead, canSend, directBlocker, isMember } from './access';

type Tx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];
const asDb = (tx: Tx) => tx as unknown as AnyDb;

/** How many messages one person may send in `MESSAGE_WINDOW_SECONDS`. */
export const MESSAGE_LIMIT = 30;
export const MESSAGE_WINDOW_SECONDS = 60;

// A table's chat and its members -------------------------------------------------------------------

/** The table's conversation, made on first use. Idempotent, safe to call under a race. */
export async function ensureTableConversation(db: AnyDb, tableId: string) {
  await db
    .insert(conversations)
    .values({ kind: 'table', tableId })
    .onConflictDoNothing({
      target: conversations.tableId,
      where: sql`${conversations.kind} = 'table'`,
    });
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.tableId, tableId), eq(conversations.kind, 'table')));
  return conversation;
}

/** Adds a person to a table's chat (a no-op when already in it). Call it where a seat is confirmed. */
export async function addTableMember(db: AnyDb, tableId: string, profileId: string) {
  const conversation = await ensureTableConversation(db, tableId);
  await db
    .insert(conversationMembers)
    .values({ conversationId: conversation.id, profileId })
    .onConflictDoNothing();
}

/** Takes a person out of a table's chat. Call it where a seat or a request is deleted. */
export async function removeTableMember(db: AnyDb, tableId: string, profileId: string) {
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.tableId, tableId), eq(conversations.kind, 'table')));
  if (!conversation) return;

  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversation.id),
        eq(conversationMembers.profileId, profileId),
      ),
    );
  // Their unread "new messages" notification would point at a chat they can no longer open.
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.recipientId, profileId),
        eq(notifications.type, 'message_received'),
        sql`${notifications.metadata}->>'conversationId' = ${conversation.id}`,
      ),
    );
}

// Direct conversations ----------------------------------------------------------------------------

/**
 * The direct conversation between the actor and `recipientId`, made when there is none. Starting one
 * needs `directBlocker` to allow it; an existing one is returned as it is (whether it takes new
 * messages is `canSend`'s call).
 */
export async function openDirect(db: AnyDb, actor: Actor | null, recipientId: string) {
  if (!actor || actor.status !== 'active' || actor.id === recipientId) {
    throw new Forbidden('message:start');
  }

  const key = pairKey(actor.id, recipientId);
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.pairKey, key), eq(conversations.kind, 'direct')));
  if (existing) return existing;

  const blocker = await directBlocker(db, actor, recipientId);
  if (blocker === 'forbidden') throw new Forbidden('message:start');
  if (blocker === 'disabled') throw new DirectMessagesOff();

  return db.transaction(async (tx) => {
    const t = asDb(tx);
    await t
      .insert(conversations)
      .values({ kind: 'direct', pairKey: key })
      .onConflictDoNothing({
        target: conversations.pairKey,
        where: sql`${conversations.kind} = 'direct'`,
      });
    const [conversation] = await t
      .select()
      .from(conversations)
      .where(and(eq(conversations.pairKey, key), eq(conversations.kind, 'direct')));
    await t
      .insert(conversationMembers)
      .values([
        { conversationId: conversation.id, profileId: actor.id },
        { conversationId: conversation.id, profileId: recipientId },
      ])
      .onConflictDoNothing();
    return conversation;
  });
}

// Sending -----------------------------------------------------------------------------------------

/**
 * Adds a message to a conversation the actor may write in. One transaction: the message, the
 * conversation's `lastMessageAt`, the sender's read mark, and one grouped "new messages"
 * notification for each other member who has not muted it (the unread one is updated, not added to:
 * "3 new messages from @ana"). Messages write no event: the audit log keeps ids and public facts,
 * and a chat is neither.
 */
export async function sendMessage(
  db: AnyDb,
  actor: Actor | null,
  conversationId: string,
  body: string,
  { tableId = null, now = new Date() }: { tableId?: string | null; now?: Date } = {},
) {
  return db.transaction(async (tx) => {
    const t = asDb(tx);
    const [conversation] = await t
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!conversation || !actor || !(await isMember(t, conversation, actor.id))) {
      throw new NotFound('no such conversation');
    }
    if (!(await canSend(t, actor, conversation))) {
      const other =
        conversation.kind === 'direct' && actor.status === 'active'
          ? await otherMember(t, conversation.id, actor.id)
          : undefined;
      if (other && !other.enabled) throw new DirectMessagesOff();
      throw new Forbidden('message:send');
    }

    // Serialise one person's sends so two at once cannot both slip under the limit.
    await t.execute(sql`select pg_advisory_xact_lock(hashtext(${'message:' + actor.id}))`);
    const windowStart = new Date(now.getTime() - MESSAGE_WINDOW_SECONDS * 1000);
    const recent = await t
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.senderId, actor.id),
          gt(messages.createdAt, windowStart),
          lte(messages.createdAt, now),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(MESSAGE_LIMIT);
    if (recent.length >= MESSAGE_LIMIT) {
      const frees = recent[recent.length - 1].createdAt.getTime() + MESSAGE_WINDOW_SECONDS * 1000;
      throw new RateLimited(Math.max(1, Math.ceil((frees - now.getTime()) / 1000)));
    }

    const [message] = await t
      .insert(messages)
      .values({
        conversationId,
        senderId: actor.id,
        body,
        tableId: conversation.kind === 'direct' ? tableId : null,
        createdAt: now,
      })
      .returning();
    await t
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId));
    await t
      .update(conversationMembers)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.profileId, actor.id),
        ),
      );

    const [table] =
      conversation.kind === 'table'
        ? await t
            .select({ id: gameTables.id, slug: gameTables.slug, title: gameTables.title })
            .from(gameTables)
            .where(eq(gameTables.id, conversation.tableId!))
        : [];
    const recipients = await t
      .select({ profileId: conversationMembers.profileId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          ne(conversationMembers.profileId, actor.id),
          isNull(conversationMembers.mutedAt),
        ),
      );
    const metadata = JSON.stringify({
      conversationId,
      kind: conversation.kind,
      count: 1,
      ...(table ? { tableId: table.id, slug: table.slug, title: table.title } : {}),
    });
    for (const { profileId } of recipients) {
      await t.execute(sql`
        insert into notifications (recipient_id, actor_id, category, type, link, metadata, created_at)
        values (${profileId}, ${actor.id}, 'messages', 'message_received',
          ${'/messages/' + conversationId}, ${metadata}::jsonb, ${now})
        on conflict (recipient_id, (metadata->>'conversationId'))
          where type = 'message_received' and read_at is null
        do update set
          actor_id = excluded.actor_id,
          created_at = excluded.created_at,
          metadata = jsonb_set(
            notifications.metadata, '{count}',
            to_jsonb((coalesce((notifications.metadata->>'count')::int, 1) + 1))
          )
      `);
    }

    return message;
  });
}

async function otherMember(db: AnyDb, conversationId: string, actorId: string) {
  const rows = await db
    .select({ id: profiles.id, enabled: profiles.directMessagesEnabled })
    .from(conversationMembers)
    .innerJoin(profiles, eq(profiles.id, conversationMembers.profileId))
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.find((row) => row.id !== actorId);
}

// Reading -----------------------------------------------------------------------------------------

export type InboxItem = Awaited<ReturnType<typeof listInbox>>['items'][number];

/**
 * The person's conversations, latest first, table chats (groups) and direct ones together. A direct
 * conversation nobody wrote in yet is left out. `page` is 1-based; a page past the last throws
 * `NotFound`.
 */
export async function listInbox(db: AnyDb, profileId: string, page = 1) {
  const visible = and(
    eq(conversationMembers.profileId, profileId),
    sql`(${conversations.kind} = 'table' OR exists (select 1 from ${messages} where ${messages.conversationId} = ${conversations.id}))`,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(visible);
  const pages = Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE));
  if (page > pages) throw new NotFound('no such page');

  const rows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      lastMessageAt: conversations.lastMessageAt,
      lastReadAt: conversationMembers.lastReadAt,
      mutedAt: conversationMembers.mutedAt,
      tableSlug: gameTables.slug,
      tableTitle: gameTables.title,
      tableImagePath: gameTables.imagePath,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .leftJoin(gameTables, eq(gameTables.id, conversations.tableId))
    .where(visible)
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
    .limit(INBOX_PAGE_SIZE)
    .offset((page - 1) * INBOX_PAGE_SIZE);
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { items: [], page, pages, total };

  const last = await db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      body: messages.body,
      senderId: messages.senderId,
      senderUsername: publicName(profiles.username),
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(profiles, eq(profiles.id, messages.senderId))
    .where(inArray(messages.conversationId, ids))
    .orderBy(messages.conversationId, desc(messages.createdAt));
  const unread = await db
    .select({ conversationId: messages.conversationId, unread: count() })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, messages.conversationId),
        eq(conversationMembers.profileId, profileId),
      ),
    )
    .where(
      and(
        inArray(messages.conversationId, ids),
        sql`${messages.senderId} is distinct from ${profileId}`,
        sql`(${conversationMembers.lastReadAt} is null or ${messages.createdAt} > ${conversationMembers.lastReadAt})`,
      ),
    )
    .groupBy(messages.conversationId);
  const others = await db
    .select({
      conversationId: conversationMembers.conversationId,
      username: publicName(profiles.username),
      avatarUrl: profiles.avatarUrl,
      avatarPath: profiles.avatarPath,
    })
    .from(conversationMembers)
    .innerJoin(profiles, eq(profiles.id, conversationMembers.profileId))
    .where(
      and(
        inArray(conversationMembers.conversationId, ids),
        ne(conversationMembers.profileId, profileId),
      ),
    );

  const lastOf = new Map(last.map((row) => [row.conversationId, row]));
  const unreadOf = new Map(unread.map((row) => [row.conversationId, row.unread]));
  const otherOf = new Map(
    others
      .filter((row) => rows.find((r) => r.id === row.conversationId)?.kind === 'direct')
      .map((row) => [row.conversationId, row]),
  );

  const items = rows.map((row) => {
    const latest = lastOf.get(row.id);
    const other = otherOf.get(row.id);
    return {
      id: row.id,
      kind: row.kind,
      title: row.kind === 'table' ? row.tableTitle! : (other?.username ?? ''),
      tableSlug: row.tableSlug,
      imagePath: row.tableImagePath,
      avatarUrl: other?.avatarUrl ?? null,
      avatarPath: other?.avatarPath ?? null,
      lastMessageAt: row.lastMessageAt,
      preview: latest
        ? {
            body: latest.body,
            own: latest.senderId === profileId,
            sender: latest.senderUsername ?? '',
          }
        : null,
      unread: unreadOf.get(row.id) ?? 0,
      muted: row.mutedAt !== null,
    };
  });
  return { items, page, pages, total };
}

/** A conversation with what the header needs, for a member. Throws `NotFound` for anyone else. */
export async function loadConversation(db: AnyDb, actor: Actor | null, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!conversation || !(await canRead(db, actor, conversation))) {
    throw new NotFound('no such conversation');
  }

  const [membership] = await db
    .select({ lastReadAt: conversationMembers.lastReadAt, mutedAt: conversationMembers.mutedAt })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.profileId, actor!.id),
      ),
    );

  const [table] = conversation.tableId
    ? await db
        .select({
          slug: gameTables.slug,
          title: gameTables.title,
          imagePath: gameTables.imagePath,
          status: gameTables.status,
        })
        .from(gameTables)
        .where(eq(gameTables.id, conversation.tableId))
    : [];
  const other =
    conversation.kind === 'direct'
      ? (
          await db
            .select({
              username: publicName(profiles.username),
              avatarUrl: profiles.avatarUrl,
              avatarPath: profiles.avatarPath,
              lastReadAt: conversationMembers.lastReadAt,
              acceptsDirect: profiles.directMessagesEnabled,
            })
            .from(conversationMembers)
            .innerJoin(profiles, eq(profiles.id, conversationMembers.profileId))
            .where(
              and(
                eq(conversationMembers.conversationId, conversationId),
                ne(conversationMembers.profileId, actor!.id),
              ),
            )
        )[0]
      : undefined;

  return {
    id: conversation.id,
    kind: conversation.kind,
    table: table ?? null,
    other: other ?? null,
    muted: (membership?.mutedAt ?? null) !== null,
    canSend: await canSend(db, actor, conversation),
  };
}

export type ThreadMessage = Awaited<ReturnType<typeof listMessages>>['messages'][number];

/**
 * A page of a conversation's messages, oldest first within the page. `before` is the `createdAt` of
 * the oldest message already shown: pass it to load the page before that. `hasMore` says whether
 * there are older ones. Only for members.
 */
export async function listMessages(
  db: AnyDb,
  actor: Actor | null,
  conversationId: string,
  { before, limit = THREAD_PAGE_SIZE }: { before?: Date; limit?: number } = {},
) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!conversation || !(await canRead(db, actor, conversation))) {
    throw new NotFound('no such conversation');
  }

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      sender: publicName(profiles.username),
      avatarUrl: profiles.avatarUrl,
      avatarPath: profiles.avatarPath,
      tableId: messages.tableId,
      tableTitle: gameTables.title,
      tableSlug: gameTables.slug,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(profiles, eq(profiles.id, messages.senderId))
    .leftJoin(gameTables, eq(gameTables.id, messages.tableId))
    .where(
      and(
        eq(messages.conversationId, conversationId),
        before ? lt(messages.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return {
    messages: page.map(({ senderId, ...row }) => ({ ...row, own: senderId === actor!.id })),
    hasMore,
  };
}

// Read marks, mute ---------------------------------------------------------------------------------

/** Everything up to now is read in this conversation, and so is its bell notification. */
export async function markConversationRead(
  db: AnyDb,
  actor: Actor | null,
  conversationId: string,
  now = new Date(),
) {
  if (!actor) throw new NotFound('no such conversation');
  await db.transaction(async (tx) => {
    const t = asDb(tx);
    await t
      .update(conversationMembers)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.profileId, actor.id),
        ),
      );
    await t
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.recipientId, actor.id),
          eq(notifications.type, 'message_received'),
          isNull(notifications.readAt),
          sql`${notifications.metadata}->>'conversationId' = ${conversationId}`,
        ),
      );
  });
}

/** Mutes or unmutes a conversation for the person: it stays in the inbox and stops using the bell. */
export async function setMuted(
  db: AnyDb,
  actor: Actor | null,
  conversationId: string,
  muted: boolean,
  now = new Date(),
) {
  if (!actor) throw new NotFound('no such conversation');
  const updated = await db
    .update(conversationMembers)
    .set({ mutedAt: muted ? now : null })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.profileId, actor.id),
      ),
    )
    .returning({ id: conversationMembers.conversationId });
  if (updated.length === 0) throw new NotFound('no such conversation');
}

/** How many conversations have messages the person has not read. The inbox badge. */
export async function unreadConversations(db: AnyDb, profileId: string): Promise<number> {
  const [row] = await db
    .select({ unread: sql<number>`count(distinct ${messages.conversationId})::int` })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, messages.conversationId),
        eq(conversationMembers.profileId, profileId),
      ),
    )
    .where(
      and(
        sql`${messages.senderId} is distinct from ${profileId}`,
        sql`(${conversationMembers.lastReadAt} is null or ${messages.createdAt} > ${conversationMembers.lastReadAt})`,
      ),
    );
  return row?.unread ?? 0;
}

/** Turns a person's direct messages on or off. */
export async function setDirectMessages(db: AnyDb, profileId: string, enabled: boolean) {
  await db
    .update(profiles)
    .set({ directMessagesEnabled: enabled })
    .where(eq(profiles.id, profileId));
}

/** Deletes a closed account's message bodies and takes them out of every conversation. */
export async function eraseMessagesOf(db: AnyDb, profileId: string) {
  await db.delete(messages).where(eq(messages.senderId, profileId));
  await db.delete(conversationMembers).where(eq(conversationMembers.profileId, profileId));
}
