import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  events,
  follows,
  gameTables,
  notifications,
  profiles,
  reports,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { DirectMessagesOff, Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { joinTable } from '@mesaaberta/core/server/registrations/service';
import {
  addTableMember,
  ensureTableConversation,
  listInbox,
  loadConversation,
  openDirect,
  sendMessage,
  unreadConversations,
} from '@mesaaberta/core/server/messages/service';
import { listBlocked, setBlocked } from '@mesaaberta/core/server/blocks/service';
import { follow } from '@mesaaberta/core/server/follows/service';
import { fileMessageReport } from '@mesaaberta/core/server/moderation/reports';
import { reportDetail } from '@mesaaberta/core/server/moderation/admin';
import { moderationDecisions } from '@mesaaberta/core/server/moderation/decisions';
import { REPORT_EXCERPT_SIZE } from '@mesaaberta/core/moderation/reports';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000030${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const ana = person(2);
const bia = person(3);
const admin: Actor = { id: id(9), role: 'admin', status: 'active' };
let counter = 0;
let minute = 0;
// Each message a minute after the one before, so the order of an excerpt is certain.
const at = () => new Date(Date.UTC(2030, 0, 1, 12, minute++));

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values([
      ...Array.from({ length: 4 }, (_, i) => ({ id: id(i + 1), username: `s${i + 1}` })),
      { id: admin.id, username: 'admin-s', role: 'admin' as const },
    ]);
});
afterAll(() => test.close());

const makeTable = async () => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `safety-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: `Mesa ${slug}`,
      kind: 'one_shot',
      capacity: 3,
      joinMode: 'auto',
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: gm.id,
      systemId: system.id,
    })
    .returning();
  await addTableMember(test.db, table.id, gm.id);
  return table;
};

const reset = async () => {
  await setBlocked(test.db, ana, gm.id, false);
  await setBlocked(test.db, gm, ana.id, false);
};

describe('blocking someone', () => {
  it('reads as direct messages off to the blocked person, who can no longer write', async () => {
    await makeTable();
    const direct = await openDirect(test.db, ana, gm.id);
    await sendMessage(test.db, ana, direct.id, 'oi', { now: at() });

    await setBlocked(test.db, gm, ana.id, true);
    await expect(sendMessage(test.db, ana, direct.id, 'oi de novo')).rejects.toThrow(
      DirectMessagesOff,
    );
    const seen = await loadConversation(test.db, ana, direct.id);
    expect(seen.canSend).toBe(false);
    expect(seen.blocked).toBe(false); // never told who blocked whom
    expect(seen.other?.acceptsDirect).toBe(false);
    await reset();
  });

  it('stops the blocker writing too, and shows them they blocked', async () => {
    await makeTable();
    const direct = await openDirect(test.db, ana, gm.id);
    await setBlocked(test.db, ana, gm.id, true);

    await expect(sendMessage(test.db, ana, direct.id, 'oi')).rejects.toThrow(Forbidden);
    expect((await loadConversation(test.db, ana, direct.id)).blocked).toBe(true);
    await reset();
  });

  it('refuses a new direct conversation either way', async () => {
    const table = await makeTable();
    await joinTable(test.db, bia, table.slug);
    await setBlocked(test.db, bia, gm.id, true);

    await expect(openDirect(test.db, gm, bia.id)).rejects.toThrow(DirectMessagesOff);
    await expect(openDirect(test.db, bia, gm.id)).rejects.toThrow(Forbidden);
    await setBlocked(test.db, bia, gm.id, false);
    await expect(openDirect(test.db, gm, bia.id)).resolves.toBeDefined();
  });

  it('takes the conversation and its unread count off the blocker’s inbox, and its bell notice', async () => {
    await makeTable();
    const direct = await openDirect(test.db, ana, gm.id);
    await sendMessage(test.db, ana, direct.id, 'oi', { now: at() });
    const before = await unreadConversations(test.db, gm.id);

    await setBlocked(test.db, gm, ana.id, true);
    expect((await listInbox(test.db, gm.id)).items.map((item) => item.id)).not.toContain(direct.id);
    expect(await unreadConversations(test.db, gm.id)).toBe(before - 1);
    const notices = await test.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientId, gm.id), eq(notifications.type, 'message_received')));
    expect(
      notices.map((row) => (row.metadata as { conversationId: string }).conversationId),
    ).not.toContain(direct.id);
    // Unblocking brings the conversation back.
    await setBlocked(test.db, gm, ana.id, false);
    expect((await listInbox(test.db, gm.id)).items.map((item) => item.id)).toContain(direct.id);
  });

  it('leaves a shared table chat as it is', async () => {
    const table = await makeTable();
    await joinTable(test.db, ana, table.slug);
    const chat = await ensureTableConversation(test.db, table.id);
    await setBlocked(test.db, ana, gm.id, true);

    await expect(sendMessage(test.db, gm, chat.id, 'sábado', { now: at() })).resolves.toBeDefined();
    await expect(sendMessage(test.db, ana, chat.id, 'ok', { now: at() })).resolves.toBeDefined();
    expect((await listInbox(test.db, ana.id)).items.map((item) => item.id)).toContain(chat.id);
    await reset();
  });

  it('ends following both ways, and a new follow is refused', async () => {
    await makeTable();
    await follow(test.db, ana, gm.id);
    await follow(test.db, gm, ana.id);
    await setBlocked(test.db, ana, gm.id, true);

    const left = await test.db.select().from(follows).where(eq(follows.followerId, gm.id));
    expect(left.filter((row) => row.followeeId === ana.id)).toEqual([]);
    await expect(follow(test.db, gm, ana.id)).rejects.toThrow(Forbidden);
    await reset();
  });

  it('still lets an admin reach someone who blocked them', async () => {
    const direct = await openDirect(test.db, admin, bia.id);
    await setBlocked(test.db, bia, admin.id, true);
    await expect(sendMessage(test.db, admin, direct.id, 'moderação')).resolves.toBeDefined();
    await setBlocked(test.db, bia, admin.id, false);
  });

  it('lists the blocked people for their blocker only, and refuses oneself', async () => {
    await setBlocked(test.db, ana, bia.id, true);
    expect((await listBlocked(test.db, ana)).map((row) => row.username)).toEqual(['s3']);
    expect(await listBlocked(test.db, bia)).toEqual([]);
    await expect(setBlocked(test.db, ana, ana.id, true)).rejects.toThrow(Forbidden);
    await setBlocked(test.db, ana, bia.id, false);
  });
});

describe('reporting from a conversation', () => {
  const reason = 'harassment' as const;

  it('copies the reported message and those before it, and tells the admins', async () => {
    await makeTable();
    const direct = await openDirect(test.db, ana, gm.id);
    const sent = [];
    for (let i = 0; i < REPORT_EXCERPT_SIZE + 2; i++)
      sent.push(await sendMessage(test.db, i % 2 ? ana : gm, direct.id, `m${i}`, { now: at() }));
    const reported = sent[REPORT_EXCERPT_SIZE]; // from the GM; one more follows it

    const { eventId } = await fileMessageReport(test.db, ana, direct.id, {
      targetType: 'message',
      messageId: reported.id,
      profileId: '',
      reason,
      details: '',
    });
    const [report] = await test.db.select().from(reports).where(eq(reports.targetId, reported.id));
    expect(report.subjectId).toBe(gm.id);
    expect(report.tableId).toBeNull();
    expect(report.excerpt?.messageId).toBe(reported.id);
    expect(report.excerpt?.messages.map((row) => row.body)).toEqual(
      sent.slice(1, REPORT_EXCERPT_SIZE + 1).map((row) => row.body),
    );
    const [event] = await test.db.select().from(events).where(eq(events.id, eventId));
    expect(event.type).toBe('ReportFiled');

    // The admin sees whom it is about and may ban them from it.
    const detail = await reportDetail(test.db, admin, report.id);
    expect(detail?.player?.id).toBe(gm.id);
    expect(detail?.can.ban).toBe(true);
    // The same report again waits on the first.
    await expect(
      fileMessageReport(test.db, ana, direct.id, {
        targetType: 'message',
        messageId: reported.id,
        profileId: '',
        reason,
        details: '',
      }),
    ).rejects.toThrow(Invalid);
  });

  it('refuses one’s own message, and anyone outside the conversation', async () => {
    await makeTable();
    const direct = await openDirect(test.db, ana, gm.id);
    const own = await sendMessage(test.db, ana, direct.id, 'meu', { now: at() });
    const input = {
      targetType: 'message' as const,
      messageId: own.id,
      profileId: '',
      reason,
      details: '',
    };
    await expect(fileMessageReport(test.db, ana, direct.id, input)).rejects.toThrow(Forbidden);
    await expect(fileMessageReport(test.db, bia, direct.id, input)).rejects.toThrow(NotFound);
  });

  it('reports a person in a table chat, at that table, and the ban reaches them', async () => {
    const table = await makeTable();
    await joinTable(test.db, ana, table.slug);
    await joinTable(test.db, bia, table.slug);
    const chat = await ensureTableConversation(test.db, table.id);
    await sendMessage(test.db, bia, chat.id, 'spam', { now: at() });

    await fileMessageReport(test.db, ana, chat.id, {
      targetType: 'person',
      messageId: '',
      profileId: bia.id,
      reason: 'spam',
      details: 'sempre isso',
    });
    const [report] = await test.db
      .select()
      .from(reports)
      .where(and(eq(reports.targetType, 'person'), eq(reports.targetId, bia.id)));
    expect(report.tableId).toBe(table.id);
    expect(report.excerpt?.messages.at(-1)?.body).toBe('spam');

    await moderationDecisions['report.ban'].apply(test.db, admin, {
      id: report.id,
      duration: '7',
      reason: 'spam',
    });
    const [banned] = await test.db.select().from(profiles).where(eq(profiles.id, bia.id));
    expect(banned.status).not.toBe('active');
  });

  it('refuses a person who is not in the conversation', async () => {
    await makeTable();
    const direct = await openDirect(test.db, ana, gm.id);
    await expect(
      fileMessageReport(test.db, ana, direct.id, {
        targetType: 'person',
        messageId: '',
        profileId: bia.id,
        reason,
        details: '',
      }),
    ).rejects.toThrow(NotFound);
  });
});
