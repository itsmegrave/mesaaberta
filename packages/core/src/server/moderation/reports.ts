import { and, desc, eq, lte } from 'drizzle-orm';
import type { ReportExcerpt } from '@mesaaberta/db/report-excerpt';
import {
  REPORT_EXCERPT_SIZE,
  type MessageReportInput,
  type ReportInput,
} from '../../moderation/reports';
import { authorize, can, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  conversations,
  gameTables,
  messages,
  profiles,
  registrations,
  reports,
} from '@mesaaberta/core/server/db/schema';
import { Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { enforceRateLimit, REPORT_LIMIT } from '@mesaaberta/core/server/rate-limit';
import { isMember } from '../messages/access';
import { publicName } from '../db/public-name';

async function seated(db: AnyDb, tableId: string, playerId: string) {
  const [row] = await db
    .select({ status: registrations.status })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)));
  return row?.status === 'confirmed';
}

/**
 * A member reports the table at `slug`, or a player they share it with (`input.playerId`). Refused
 * for oneself, for a player the two do not share, and while the same report is still waiting on an
 * admin. Counts against REPORT_LIMIT. Returns the `ReportFiled` event to dispatch.
 */
export async function fileReport(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: ReportInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventId: string }> {
  const [table] = await db
    .select({ id: gameTables.id, gmId: gameTables.gmId, status: gameTables.status })
    .from(gameTables)
    .where(eq(gameTables.slug, slug));
  // A disabled table is off the public pages: there is nothing left to report.
  if (!table || table.status === 'disabled') throw new NotFound(`no table with slug "${slug}"`);

  const playerId = input.targetType === 'player' ? input.playerId : '';
  if (input.targetType === 'player' && !playerId) throw new Invalid('playerId', 'required');
  const reporterSeated = actor ? await seated(db, table.id, actor.id) : false;
  authorize(actor, 'report:file', {
    gmId: table.gmId,
    reporterSeated,
    target:
      input.targetType === 'table'
        ? { type: 'table' }
        : { type: 'player', playerId, playerSeated: await seated(db, table.id, playerId) },
  });

  const targetId = input.targetType === 'table' ? table.id : playerId;
  const eventId = await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await enforceRateLimit(t, actor!.id, REPORT_LIMIT, now);
    const [report] = await t
      .insert(reports)
      .values({
        reporterId: actor!.id,
        targetType: input.targetType,
        targetId,
        tableId: table.id,
        reason: input.reason,
        details: input.details,
        createdAt: now,
      })
      // The partial unique index: this reporter already has one waiting for the same target.
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!report) throw new Invalid('', 'already_reported');

    return recordEvent(
      t,
      {
        type: 'ReportFiled',
        actorId: actor!.id,
        payload: {
          reportId: report.id,
          targetType: input.targetType,
          targetId,
          tableId: table.id,
          reason: input.reason,
        },
      },
      { now },
    );
  });

  return { eventId };
}

/**
 * What this visitor may report at a table: the table itself, and the people they share it with
 * (the GM and the confirmed players, never themselves). Names go only to someone who shares the
 * table, who already sees them in its chat.
 */
export async function reportTargetsOf(
  db: AnyDb,
  actor: Actor | null,
  table: { id: string; gmId: string },
) {
  if (!actor) return { table: false, people: [] };
  const reporterSeated = await seated(db, table.id, actor.id);
  const facts = { gmId: table.gmId, reporterSeated };
  const canTable = can(actor, 'report:file', { ...facts, target: { type: 'table' } });
  if (actor.id !== table.gmId && !reporterSeated) return { table: canTable, people: [] };

  const seatedPlayers = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(registrations)
    .innerJoin(profiles, eq(profiles.id, registrations.playerId))
    .where(and(eq(registrations.tableId, table.id), eq(registrations.status, 'confirmed')));
  const [gm] = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, table.gmId));
  const seatedIds = new Set(seatedPlayers.map((player) => player.id));
  const people = [...(gm ? [gm] : []), ...seatedPlayers].filter(
    (person): person is { id: string; username: string } =>
      person.username !== null &&
      can(actor, 'report:file', {
        ...facts,
        target: { type: 'player', playerId: person.id, playerSeated: seatedIds.has(person.id) },
      }),
  );
  return { table: canTable, people };
}

/**
 * The person a report is about: the reported player, or the subject of a message or person report.
 * Null for a table, a campaign or a partner, and for a message whose sender's account is gone.
 */
export const reportSubject = (report: {
  targetType: string;
  targetId: string;
  subjectId: string | null;
}) => (report.targetType === 'player' ? report.targetId : report.subjectId);

/**
 * The messages a report copies: up to REPORT_EXCERPT_SIZE of the conversation, oldest first, ending
 * at `until` (the reported message, or the person's last one).
 */
async function excerptUntil(db: AnyDb, conversationId: string, until: Date) {
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      username: publicName(profiles.username),
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(profiles, eq(profiles.id, messages.senderId))
    .where(and(eq(messages.conversationId, conversationId), lte(messages.createdAt, until)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(REPORT_EXCERPT_SIZE);
  return rows.reverse().map((row) => ({
    ...row,
    username: row.senderId ? row.username : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * A member reports a message in a conversation they are in, or a person they talk to there
 * (`message:report`). The report keeps a copy of the messages around it (`ReportExcerpt`), so the
 * admin reads those and never the conversation. Refused for one's own message or oneself, for a
 * person outside the conversation, and while the same report still waits on an admin. Counts
 * against REPORT_LIMIT. Returns the `ReportFiled` event to dispatch.
 */
export async function fileMessageReport(
  db: AnyDb,
  actor: Actor | null,
  conversationId: string,
  input: MessageReportInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventId: string }> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  const member = !!conversation && !!actor && (await isMember(db, conversation, actor.id));
  if (!conversation || !member) throw new NotFound('no such conversation');

  let subjectId: string | null;
  let until: Date;
  if (input.targetType === 'message') {
    const [message] = await db
      .select({ senderId: messages.senderId, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, input.messageId), eq(messages.conversationId, conversationId)));
    if (!message) throw new NotFound('no such message');
    subjectId = message.senderId;
    until = message.createdAt;
  } else {
    // Someone in this conversation now: the other person of a direct one, a table's GM or players.
    subjectId = (await isMember(db, conversation, input.profileId)) ? input.profileId : null;
    if (!subjectId) throw new NotFound('no such person here');
    const [last] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.senderId, subjectId)))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    until = last?.createdAt ?? now;
  }
  authorize(actor, 'message:report', { member, subjectId });

  const excerpt: ReportExcerpt = {
    conversationId,
    kind: conversation.kind,
    messageId: input.targetType === 'message' ? input.messageId : null,
    messages: await excerptUntil(db, conversationId, until),
  };
  const targetId = input.targetType === 'message' ? input.messageId : subjectId!;
  const eventId = await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await enforceRateLimit(t, actor!.id, REPORT_LIMIT, now);
    const [report] = await t
      .insert(reports)
      .values({
        reporterId: actor!.id,
        targetType: input.targetType,
        targetId,
        tableId: conversation.tableId,
        subjectId,
        excerpt,
        reason: input.reason,
        details: input.details,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!report) throw new Invalid('', 'already_reported');

    return recordEvent(
      t,
      {
        type: 'ReportFiled',
        actorId: actor!.id,
        payload: {
          reportId: report.id,
          targetType: input.targetType,
          targetId,
          tableId: conversation.tableId,
          reason: input.reason,
        },
      },
      { now },
    );
  });

  return { eventId };
}
