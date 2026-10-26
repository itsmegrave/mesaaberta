// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  gameTables,
  playerInvitations,
  profiles,
  registrations,
  sessionCloseReminders,
} from '../db/schema';
import { Invalid } from '../errors';
import { recordEvent } from '../events/outbox';
import { nextStatus } from '../../tables/lifecycle-machine';
import { cancelPendingInvitations } from '../invitations/service';
import { sessionEndedBy } from './lifecycle';
import { nextWeeklySession, weeklyInterval } from './schedule';
import {
  assertTableSchedule,
  lockTableFamily,
  lockTableRows,
  lockTableSchedule,
} from './schedule-guard';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** The flag that turns the reminders and the automatic close on, targeted by the GM. */
export const CLOSE_REMINDERS_FLAG = 'use_session_close_reminders';

/** The two e-mails a GM gets: an hour after the session ended, then a week after. */
export type CloseReminderStep = '1h' | '7d';

/** When the GM is first reminded, and when for the last time. */
export const FIRST_REMINDER_AFTER = HOUR;
export const LAST_REMINDER_AFTER = 7 * DAY;
/** When a session nobody answered for is settled for the GM, counted from its end. */
export const AUTO_CLOSE_AFTER = 10 * DAY;
/** The least time between the last reminder and the close, so a GM always gets a few days' warning. */
export const AUTO_CLOSE_NOTICE = 3 * DAY;

/** When a session that starts at `startsAt` and lasts `durationMinutes` is over. */
export const sessionEnd = (startsAt: Date, durationMinutes: number) =>
  new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

/**
 * When a table whose last reminder went out at `lastSentAt` is concluded: ten days after its
 * session, and never sooner than three days after that reminder (a table that waited from before
 * the reminders existed gets its warning first).
 */
export const autoCloseAt = (endedAt: Date, lastSentAt: Date) =>
  new Date(
    Math.max(endedAt.getTime() + AUTO_CLOSE_AFTER, lastSentAt.getTime() + AUTO_CLOSE_NOTICE),
  );

/**
 * What a table still waiting on its GM is due at `now`: the first reminder from an hour after its
 * session, the last one from a week after (the first is skipped when it is that late already), the
 * close once the last one has had its notice, or nothing. `sent` holds the steps already sent for
 * this session, with when.
 */
export function closeStepFor(
  endedAt: Date,
  now: Date,
  sent: Partial<Record<CloseReminderStep, Date>>,
): CloseReminderStep | 'close' | null {
  const elapsed = now.getTime() - endedAt.getTime();
  if (elapsed < FIRST_REMINDER_AFTER) return null;
  if (elapsed < LAST_REMINDER_AFTER) return sent['1h'] ? null : '1h';
  if (!sent['7d']) return '7d';
  return now >= autoCloseAt(endedAt, sent['7d']) ? 'close' : null;
}

/** Who a flag is read for: the GM, as the web app targets a signed-in person. */
export type CloseReminderTarget = { id: string; isAdmin: boolean };

/**
 * Reminds the GMs of the tables awaiting confirmation to say whether the session happened, by
 * e-mail an hour after it ended and a week after, and settles it for them ten days after it
 * (`closeStepFor`): a one-shot is concluded (`autoClose`), a campaign or adventure goes on to its
 * next session (`autoHold`). Either way the players are asked to rate it. Only for the GMs `enabled` says yes to. Each step is one row in
 * `session_close_reminders`, written with its event in one transaction, so a second sweep finds it
 * done; the close takes the table only while it still waits. The e-mails go out from the events'
 * handlers. Returns the ids of the events, which are due at once.
 */
export async function remindToClose(
  db: AnyDb,
  now: Date,
  enabled: (gm: CloseReminderTarget) => Promise<boolean>,
): Promise<{ reminded: string[]; closed: string[] }> {
  const due = await db
    .select({
      id: gameTables.id,
      slug: gameTables.slug,
      title: gameTables.title,
      startsAt: gameTables.startsAt,
      durationMinutes: gameTables.durationMinutes,
      kind: gameTables.kind,
      gmId: gameTables.gmId,
      gmRole: profiles.role,
    })
    .from(gameTables)
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .where(
      and(
        eq(gameTables.status, 'awaiting_confirmation'),
        sessionEndedBy(new Date(now.getTime() - FIRST_REMINDER_AFTER)),
      ),
    );
  const reminded: string[] = [];
  const closed: string[] = [];
  if (due.length === 0) return { reminded, closed };

  const sentRows = await db
    .select()
    .from(sessionCloseReminders)
    .where(
      inArray(
        sessionCloseReminders.tableId,
        due.map((table) => table.id),
      ),
    );
  const answers = new Map<string, Promise<boolean>>();
  const allowed = (gmId: string, role: string) => {
    if (!answers.has(gmId)) answers.set(gmId, enabled({ id: gmId, isAdmin: role === 'admin' }));
    return answers.get(gmId)!;
  };

  for (const table of due) {
    const sent: Partial<Record<CloseReminderStep, Date>> = {};
    for (const row of sentRows) {
      if (row.tableId === table.id && row.startsAt.getTime() === table.startsAt.getTime())
        sent[row.step] = row.sentAt;
    }
    const step = closeStepFor(sessionEnd(table.startsAt, table.durationMinutes), now, sent);
    if (!step || !(await allowed(table.gmId, table.gmRole))) continue;
    if (step === 'close') {
      const eventIds =
        table.kind === 'one_shot'
          ? [await autoClose(db, table, now)]
          : await autoHold(db, table, now);
      closed.push(...eventIds.filter((eventId): eventId is string => eventId !== null));
    } else {
      const eventId = await remind(db, table, step, now);
      if (eventId) reminded.push(eventId);
    }
  }
  return { reminded, closed };
}

type DueTable = { id: string; slug: string; title: string; startsAt: Date; gmId: string };

async function remind(
  db: AnyDb,
  table: DueTable,
  step: CloseReminderStep,
  now: Date,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [written] = await tx
      .insert(sessionCloseReminders)
      .values({ tableId: table.id, startsAt: table.startsAt, step, sentAt: now })
      .onConflictDoNothing()
      .returning({ tableId: sessionCloseReminders.tableId });
    if (!written) return null;
    return recordEvent(
      tx as unknown as AnyDb,
      {
        type: 'TableCloseReminder',
        actorId: null,
        payload: { tableId: table.id, slug: table.slug, title: table.title, step },
      },
      { now },
    );
  });
}

/**
 * Concludes a table for its GM, as if they had said it happened without saying who came: every
 * confirmed player can rate, and is asked to. The update takes the table only while it still waits
 * on the same session, so a GM answering at the same moment wins or loses cleanly.
 */
async function autoClose(db: AnyDb, table: DueTable, now: Date): Promise<string | null> {
  return db.transaction(async (tx) => {
    await lockTableRows(tx as unknown as AnyDb, [table.id]);
    const [updated] = await tx
      .update(gameTables)
      .set({ status: nextStatus('awaiting_confirmation', 'HAPPENED')! })
      .where(
        and(
          eq(gameTables.id, table.id),
          eq(gameTables.status, 'awaiting_confirmation'),
          eq(gameTables.startsAt, table.startsAt),
        ),
      )
      .returning({ id: gameTables.id });
    if (!updated) return null;
    await cancelPendingInvitations(
      tx as unknown as AnyDb,
      eq(playerInvitations.tableId, table.id),
      'table_changed',
      now,
    );
    return recordEvent(
      tx as unknown as AnyDb,
      {
        type: 'TableConcluded',
        actorId: null,
        payload: { tableId: table.id, slug: table.slug, title: table.title, autoClosed: true },
      },
      { now },
    );
  });
}

/** How many later dates `autoHold` tries when the next one clashes with another of the GM's tables. */
const HOLD_ATTEMPTS = 8;

/**
 * Settles a campaign's or an adventure's session for its GM, as if they had said it happened and
 * more follow, without saying who came: the table opens again for its next date (the next weekly
 * one: a campaign's own interval, a week for an adventure, which has none; a date that clashes with
 * another of the GM's tables is skipped) and every confirmed player not marked absent is let rate
 * it. The GM can still move the date. A table with no free date in sight is left waiting.
 */
async function autoHold(db: AnyDb, table: DueTable, now: Date): Promise<string[]> {
  return db.transaction(async (tx) => {
    const executor = tx as unknown as AnyDb;
    await lockTableSchedule(executor, table.gmId);
    const { table: current, linked } = await lockTableFamily(executor, table.id);
    if (
      current.status !== 'awaiting_confirmation' ||
      current.startsAt.getTime() !== table.startsAt.getTime()
    )
      return [];
    const interval = weeklyInterval(current.recurrence) ?? 1;
    let startsAt: Date | null = nextWeeklySession(
      current.startsAt,
      interval,
      current.timezone,
      now,
    );
    for (let attempt = 1; startsAt; attempt++) {
      try {
        assertTableSchedule(linked, { ...current, startsAt }, current.id);
        break;
      } catch (error) {
        if (!(error instanceof Invalid)) throw error;
        startsAt =
          attempt < HOLD_ATTEMPTS
            ? nextWeeklySession(startsAt, interval, current.timezone, startsAt)
            : null;
      }
    }
    if (!startsAt) return [];

    const [updated] = await tx
      .update(gameTables)
      .set({
        status: nextStatus('awaiting_confirmation', 'SESSION_HELD')!,
        startsAt,
        icalSequence: current.icalSequence + 1,
      })
      .where(and(eq(gameTables.id, table.id), eq(gameTables.status, 'awaiting_confirmation')))
      .returning({ id: gameTables.id });
    if (!updated) return [];
    await cancelPendingInvitations(
      executor,
      eq(playerInvitations.tableId, table.id),
      'table_changed',
      now,
    );
    const opened = await tx
      .update(registrations)
      .set({ ratingOpenedAt: now })
      .where(
        and(
          eq(registrations.tableId, table.id),
          eq(registrations.status, 'confirmed'),
          or(isNull(registrations.attended), eq(registrations.attended, true)),
          isNull(registrations.ratingOpenedAt),
        ),
      )
      .returning({ id: registrations.playerId });
    const facts = { tableId: table.id, slug: table.slug, title: table.title };
    const held = await recordEvent(
      executor,
      {
        type: 'TableSessionHeld',
        actorId: null,
        payload: { ...facts, nextStartsAt: startsAt.toISOString(), autoClosed: true },
      },
      { now },
    );
    if (opened.length === 0) return [held];
    const ratingsOpened = await recordEvent(
      executor,
      {
        type: 'RatingsOpened',
        actorId: null,
        payload: { ...facts, playerIds: opened.map(({ id }) => id), autoClosed: true },
      },
      { now },
    );
    return [held, ratingsOpened];
  });
}
