import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  conversationMembers,
  conversations,
  gameTables,
  messages,
  notifications,
  profiles,
  systems,
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import { DirectMessagesOff, Forbidden, NotFound, RateLimited } from '../errors';
import { approveRegistration, joinTable, leaveTable, removePlayer } from '../registrations/service';
import {
  MESSAGE_LIMIT,
  addTableMember,
  ensureTableConversation,
  eraseMessagesOf,
  listInbox,
  listMessages,
  loadConversation,
  markConversationRead,
  openDirect,
  sendMessage,
  setDirectMessages,
  setMuted,
  unreadConversations,
} from './service';
import { pruneTableChats } from './retention';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000020${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const ana = person(2);
const bia = person(3);
const cris = person(4);
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values(Array.from({ length: 6 }, (_, i) => ({ id: id(i + 1), username: `p${i + 1}` })));
});
afterAll(() => test.close());

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `chat-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: `Mesa ${slug}`,
      kind: 'one_shot',
      capacity: 3,
      joinMode: 'approval',
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: gm.id,
      systemId: system.id,
      ...over,
    })
    .returning();
  await addTableMember(test.db, table.id, gm.id);
  return table;
};

const membersOf = async (conversationId: string) =>
  (
    await test.db
      .select({ id: conversationMembers.profileId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId))
  )
    .map((row) => row.id)
    .sort();

const bell = async (recipient: Actor, conversationId: string) =>
  (
    await test.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipient.id),
          eq(notifications.type, 'message_received'),
        ),
      )
  ).filter((row) => (row.metadata as { conversationId: string }).conversationId === conversationId);

describe('table chat', () => {
  it('is joined by the GM, and by a player once they hold a seat', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, ana, table.slug);
    expect(await membersOf(conversation.id)).toEqual([gm.id]); // a pending request is not in it

    await approveRegistration(test.db, gm, table.slug, ana.id);
    expect(await membersOf(conversation.id)).toEqual([gm.id, ana.id].sort());
  });

  it('is left with the seat, when the player leaves or is removed', async () => {
    const table = await makeTable({ joinMode: 'auto' });
    const conversation = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, ana, table.slug);
    await joinTable(test.db, bia, table.slug);
    await leaveTable(test.db, ana, table.slug);
    await removePlayer(test.db, gm, table.slug, bia.id);

    expect(await membersOf(conversation.id)).toEqual([gm.id]);
    await expect(loadConversation(test.db, ana, conversation.id)).rejects.toThrow(NotFound);
    await expect(sendMessage(test.db, ana, conversation.id, 'oi')).rejects.toThrow(NotFound);
  });

  it('lets a member write and notifies the others once, counting up', async () => {
    const table = await makeTable({ joinMode: 'auto' });
    const conversation = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, ana, table.slug);

    await sendMessage(test.db, gm, conversation.id, 'bem-vindos');
    await sendMessage(test.db, gm, conversation.id, 'sábado às 20h');

    const [item] = await bell(ana, conversation.id);
    expect(item.link).toBe(`/messages/${conversation.id}`);
    expect((item.metadata as { count: number }).count).toBe(2);
    expect(await bell(gm, conversation.id)).toHaveLength(0); // never for the sender
  });

  it('starts a new notification once the conversation was read', async () => {
    const table = await makeTable({ joinMode: 'auto' });
    const conversation = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, ana, table.slug);
    await sendMessage(test.db, gm, conversation.id, 'um');
    await markConversationRead(test.db, ana, conversation.id);
    await sendMessage(test.db, gm, conversation.id, 'dois');

    const items = await bell(ana, conversation.id);
    expect(items).toHaveLength(2);
    expect(items.filter((row) => row.readAt === null)).toHaveLength(1);
  });

  it('adds nothing to the bell of someone who muted it', async () => {
    const table = await makeTable({ joinMode: 'auto' });
    const conversation = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, ana, table.slug);
    await setMuted(test.db, ana, conversation.id, true);
    await sendMessage(test.db, gm, conversation.id, 'silêncio');

    expect(await bell(ana, conversation.id)).toHaveLength(0);
    expect((await listInbox(test.db, ana.id)).items[0].unread).toBeGreaterThan(0);
  });

  it('stops taking messages once the table is disabled, but stays readable', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    await sendMessage(test.db, gm, conversation.id, 'antes');
    await test.db.update(gameTables).set({ status: 'disabled' }).where(eq(gameTables.id, table.id));

    await expect(sendMessage(test.db, gm, conversation.id, 'depois')).rejects.toThrow(Forbidden);
    expect((await listMessages(test.db, gm, conversation.id)).messages).toHaveLength(1);
  });

  it('is refused to a suspended member', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    await expect(
      sendMessage(test.db, { ...gm, status: 'suspended' }, conversation.id, 'oi'),
    ).rejects.toThrow(Forbidden);
  });
});

describe('direct messages', () => {
  it('lets anyone write to the GM of an active table before joining', async () => {
    await makeTable();
    const conversation = await openDirect(test.db, cris, gm.id);
    const table = await makeTable();
    const message = await sendMessage(test.db, cris, conversation.id, 'tem vaga?', {
      tableId: table.id,
    });

    expect(message.tableId).toBe(table.id);
    expect(await membersOf(conversation.id)).toEqual([gm.id, cris.id].sort());
    expect((await bell(gm, conversation.id))[0].actorId).toBe(cris.id);
    // The same pair has one thread, whoever opens it.
    expect((await openDirect(test.db, gm, cris.id)).id).toBe(conversation.id);
  });

  it('lets a GM write to a player of their table, not to a stranger', async () => {
    const table = await makeTable({ joinMode: 'auto' });
    await joinTable(test.db, bia, table.slug);
    await expect(openDirect(test.db, gm, bia.id)).resolves.toBeDefined();
    await expect(openDirect(test.db, ana, cris.id)).rejects.toThrow(Forbidden);
    await expect(openDirect(test.db, gm, gm.id)).rejects.toThrow(Forbidden);
  });

  it('cannot be started when the GM turned direct messages off, and stops taking new ones', async () => {
    const other = person(5);
    const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
    await test.db.insert(gameTables).values({
      slug: 'mesa-off',
      title: 'Mesa off',
      kind: 'one_shot',
      capacity: 2,
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: other.id,
      systemId: system.id,
    });
    const conversation = await openDirect(test.db, cris, other.id);
    await sendMessage(test.db, cris, conversation.id, 'oi');

    await setDirectMessages(test.db, other.id, false);
    await expect(sendMessage(test.db, cris, conversation.id, 'de novo')).rejects.toThrow(
      DirectMessagesOff,
    );
    // Reading still works, and the person who turned it off can read what came before.
    expect((await listMessages(test.db, other, conversation.id)).messages).toHaveLength(1);
    // A new pair cannot start.
    await expect(openDirect(test.db, bia, other.id)).rejects.toThrow(DirectMessagesOff);
    await setDirectMessages(test.db, other.id, true);
  });

  it('keeps a direct conversation with no message out of the inbox', async () => {
    const empty = await openDirect(test.db, ana, gm.id);
    const inbox = await listInbox(test.db, ana.id);
    expect(inbox.items.find((item) => item.id === empty.id)).toBeUndefined();
  });
});

describe('inbox and threads', () => {
  it('orders by the latest message and counts what is unread, groups and DMs together', async () => {
    const reader = person(6);
    const table = await makeTable({ joinMode: 'auto' });
    const group = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, reader, table.slug);
    const direct = await openDirect(test.db, gm, reader.id);

    await sendMessage(test.db, gm, group.id, 'no grupo', { now: new Date('2030-01-01T10:00:00Z') });
    await sendMessage(test.db, gm, direct.id, 'no privado', {
      now: new Date('2030-01-01T11:00:00Z'),
    });

    const { items } = await listInbox(test.db, reader.id);
    expect(items.slice(0, 2).map((item) => item.id)).toEqual([direct.id, group.id]);
    expect(items[0]).toMatchObject({ kind: 'direct', title: 'p1', unread: 1 });
    expect(items[0].preview).toMatchObject({ body: 'no privado', own: false });
    expect(items[1]).toMatchObject({ kind: 'table', title: table.title, unread: 1 });
    expect(await unreadConversations(test.db, reader.id)).toBe(2);

    await markConversationRead(test.db, reader, direct.id, new Date('2030-06-01T00:00:00Z'));
    expect(await unreadConversations(test.db, reader.id)).toBe(1);
  });

  it('lists the direct conversations and the tables’ apart, each counting what is unread', async () => {
    // Someone new, so what other tests left unread does not count.
    const reader = person(7);
    await test.db.insert(profiles).values({ id: reader.id, username: 'p7' });
    const table = await makeTable({ joinMode: 'auto' });
    const group = await ensureTableConversation(test.db, table.id);
    await joinTable(test.db, reader, table.slug);
    const direct = await openDirect(test.db, gm, reader.id);
    await sendMessage(test.db, gm, group.id, 'no grupo', { now: new Date('2030-02-01T10:00:00Z') });
    await sendMessage(test.db, gm, direct.id, 'no privado', {
      now: new Date('2030-02-01T11:00:00Z'),
    });

    const directOnly = await listInbox(test.db, reader.id, 1, 'direct');
    const tablesOnly = await listInbox(test.db, reader.id, 1, 'table');

    expect(directOnly.items.map((item) => item.id)).toEqual([direct.id]);
    expect(tablesOnly.items.map((item) => item.id)).toEqual([group.id]);
    expect(tablesOnly.items.every((item) => item.kind === 'table')).toBe(true);
    // The counts do not depend on which tab is open.
    expect(directOnly.unreadByKind).toEqual({ direct: 1, table: 1 });
    expect(tablesOnly.unreadByKind).toEqual({ direct: 1, table: 1 });

    await markConversationRead(test.db, reader, direct.id, new Date('2030-06-01T00:00:00Z'));
    expect((await listInbox(test.db, reader.id)).unreadByKind).toEqual({ direct: 0, table: 1 });
  });

  it('answers 404 past the last inbox page', async () => {
    await expect(listInbox(test.db, ana.id, 999)).rejects.toThrow(NotFound);
  });

  it('pages a thread back from the oldest message shown', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    for (let i = 0; i < 5; i++) {
      await sendMessage(test.db, gm, conversation.id, `m${i}`, {
        now: new Date(Date.UTC(2031, 0, 1, 10, i)),
      });
    }
    const first = await listMessages(test.db, gm, conversation.id, { limit: 3 });
    expect(first.messages.map((m) => m.body)).toEqual(['m2', 'm3', 'm4']);
    expect(first.hasMore).toBe(true);

    const older = await listMessages(test.db, gm, conversation.id, {
      limit: 3,
      before: first.messages[0].createdAt,
    });
    expect(older.messages.map((m) => m.body)).toEqual(['m0', 'm1']);
    expect(older.hasMore).toBe(false);
  });

  it('hides a conversation from people who are not in it', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    await expect(listMessages(test.db, cris, conversation.id)).rejects.toThrow(NotFound);
    await expect(listMessages(test.db, null, conversation.id)).rejects.toThrow(NotFound);
  });
});

describe('limits and retention', () => {
  it('refuses a sender past the per-minute limit, and counts each person alone', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    const now = new Date('2032-01-01T10:00:00Z');
    for (let i = 0; i < MESSAGE_LIMIT; i++) {
      await sendMessage(test.db, gm, conversation.id, `m${i}`, { now });
    }
    await expect(sendMessage(test.db, gm, conversation.id, 'demais', { now })).rejects.toThrow(
      RateLimited,
    );
    const later = new Date(now.getTime() + 61_000);
    await expect(
      sendMessage(test.db, gm, conversation.id, 'de novo', { now: later }),
    ).resolves.toBeDefined();
  });

  it('deletes a table chat 90 days after the table was disabled, and not before', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    await sendMessage(test.db, gm, conversation.id, 'adeus');
    const disabledAt = new Date('2033-01-01T00:00:00Z');
    await test.db
      .update(gameTables)
      .set({ status: 'disabled', updatedAt: disabledAt })
      .where(eq(gameTables.id, table.id));

    await pruneTableChats(test.db, new Date('2033-03-30T00:00:00Z'));
    expect(
      await test.db.select().from(conversations).where(eq(conversations.id, conversation.id)),
    ).toHaveLength(1);

    expect(await pruneTableChats(test.db, new Date('2033-04-02T00:00:00Z'))).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      await test.db.select().from(conversations).where(eq(conversations.id, conversation.id)),
    ).toHaveLength(0);
    expect(
      await test.db.select().from(messages).where(eq(messages.conversationId, conversation.id)),
    ).toHaveLength(0);
  });

  it('erases a closed account’s messages and memberships', async () => {
    const table = await makeTable();
    const conversation = await ensureTableConversation(test.db, table.id);
    await sendMessage(test.db, gm, conversation.id, 'meu segredo');
    await eraseMessagesOf(test.db, gm.id);

    expect(await membersOf(conversation.id)).toEqual([]);
    expect(await test.db.select().from(messages).where(eq(messages.senderId, gm.id))).toHaveLength(
      0,
    );
  });
});
