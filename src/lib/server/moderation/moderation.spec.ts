import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  notifications,
  profiles,
  registrations,
  reports,
  systems,
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { moderationHandler } from '../events/moderation';
import type { StoredEvent } from '../events/types';
import { fileReport, reportTargetsOf } from './reports';
import {
  auditLog,
  closeReport,
  listReports,
  banAccount,
  closeReportedTable,
  moderationOf,
  reportDetail,
  revokeBan,
  startReview,
} from './admin';
import { liftExpiredBans, stillBanned } from './bans';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000020${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = member(1);
const admin: Actor = { id: id(90), role: 'admin', status: 'active' };
const otherAdmin: Actor = { id: id(91), role: 'admin', status: 'active' };
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values([
      ...Array.from({ length: 8 }, (_, i) => ({ id: id(i + 1), username: `m${i + 1}` })),
      { id: id(90), username: 'admin', role: 'admin' as const },
      { id: id(91), username: 'admin2', role: 'admin' as const },
    ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(reports);
  await test.db.delete(events);
  await test.db.delete(registrations);
  await test.db
    .update(profiles)
    .set({ status: 'active', bannedAt: null, bannedUntil: null, banReason: null });
});

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `mod-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 4,
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: gm.id,
      systemId: system.id,
      ...over,
    })
    .returning();
  return table;
};
const seat = (tableId: string, playerId: string, status: 'confirmed' | 'pending' = 'confirmed') =>
  test.db.insert(registrations).values({ tableId, playerId, status });

const tableReport = { targetType: 'table' as const, playerId: '', reason: 'spam' as const };
const playerReport = (playerId: string) => ({
  targetType: 'player' as const,
  playerId,
  reason: 'harassment' as const,
  details: '',
});

const reportRow = async () => (await test.db.select().from(reports))[0];
const stored = async (eventId: string) => {
  const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
  return { ...row, attempts: 0 } as unknown as StoredEvent;
};

describe('fileReport', () => {
  it('files a report about a table and records ReportFiled, without the details', async () => {
    const table = await makeTable();

    const { eventId } = await fileReport(test.db, member(2), table.slug, {
      ...tableReport,
      details: '<b>spam</b> links',
    });

    const report = await reportRow();
    expect(report).toMatchObject({
      reporterId: id(2),
      targetType: 'table',
      targetId: table.id,
      tableId: table.id,
      status: 'open',
      details: '<b>spam</b> links',
    });
    const [event] = await test.db.select().from(events).where(eq(events.id, eventId));
    expect(event.type).toBe('ReportFiled');
    expect(JSON.stringify(event.payload)).not.toContain('spam</b>');
  });

  it('refuses the GM reporting their own table', async () => {
    const table = await makeTable();
    await expect(
      fileReport(test.db, gm, table.slug, { ...tableReport, details: '' }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('lets a seated player report the GM and a fellow player, never themselves', async () => {
    const table = await makeTable();
    await seat(table.id, id(2));
    await seat(table.id, id(3));

    await fileReport(test.db, member(2), table.slug, playerReport(gm.id));
    await fileReport(test.db, member(2), table.slug, playerReport(id(3)));
    await expect(
      fileReport(test.db, member(2), table.slug, playerReport(id(2))),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('refuses reporting a player the two do not share a table with', async () => {
    const table = await makeTable();
    await seat(table.id, id(3));
    // Member 2 only asked for a seat: a pending request shares nothing.
    await seat(table.id, id(2), 'pending');

    await expect(
      fileReport(test.db, member(2), table.slug, playerReport(id(3))),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('refuses a second report on the same target while the first still waits', async () => {
    const table = await makeTable();
    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });

    await expect(
      fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' }),
    ).rejects.toMatchObject({ name: 'Invalid', message: 'already_reported' });

    // Once an admin closed it, the reporter may report again.
    const report = await reportRow();
    await closeReport(test.db, admin, report.id, 'dismissed', '');
    await expect(
      fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' }),
    ).resolves.toHaveProperty('eventId');
  });

  it('stops a member after REPORT_LIMIT reports in a day', async () => {
    for (let i = 0; i < 5; i++) {
      const table = await makeTable();
      await fileReport(test.db, member(4), table.slug, { ...tableReport, details: '' });
    }
    const table = await makeTable();
    await expect(
      fileReport(test.db, member(4), table.slug, { ...tableReport, details: '' }),
    ).rejects.toBeInstanceOf(RateLimited);
  });

  it('answers not found for a disabled table and refuses a suspended reporter', async () => {
    const disabled = await makeTable({ status: 'disabled' });
    await expect(
      fileReport(test.db, member(2), disabled.slug, { ...tableReport, details: '' }),
    ).rejects.toBeInstanceOf(NotFound);

    const table = await makeTable();
    await expect(
      fileReport(test.db, { ...member(2), status: 'suspended' }, table.slug, {
        ...tableReport,
        details: '',
      }),
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe('reportTargetsOf', () => {
  it('offers names only to someone who shares the table', async () => {
    const table = await makeTable();
    await seat(table.id, id(2));
    await seat(table.id, id(3));

    const outsider = await reportTargetsOf(test.db, member(5), table);
    expect(outsider).toEqual({ table: true, people: [] });

    const seated = await reportTargetsOf(test.db, member(2), table);
    expect(seated.table).toBe(true);
    expect(seated.people.map((person) => person.id).sort()).toEqual([gm.id, id(3)].sort());

    const theGm = await reportTargetsOf(test.db, gm, table);
    expect(theGm.table).toBe(false);
    expect(theGm.people.map((person) => person.id).sort()).toEqual([id(2), id(3)].sort());
  });
});

describe('the report queue', () => {
  it('lists waiting reports for admins only, and has no page past the last', async () => {
    const table = await makeTable();
    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });

    await expect(listReports(test.db, member(2), new URLSearchParams())).rejects.toBeInstanceOf(
      Forbidden,
    );
    const page = await listReports(test.db, admin, new URLSearchParams());
    expect(page?.rows).toHaveLength(1);
    expect(await listReports(test.db, admin, new URLSearchParams('page=2'))).toBeNull();

    const closed = await listReports(test.db, admin, new URLSearchParams('status=resolved'));
    expect(closed?.rows).toHaveLength(0);
  });

  it('counts what each status would show, and narrows to tables or players', async () => {
    const table = await makeTable();
    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });

    const all = await listReports(test.db, admin, new URLSearchParams());
    expect(all?.counts).toMatchObject({ all: 1, waiting: 1, resolved: 0, dismissed: 0 });
    expect(all?.rows[0]).toMatchObject({ targetType: 'table', table: table.title });
    expect(all?.rows[0].gm).toEqual(expect.any(String));
    // Counts follow the kind of report, so "Perfis" shows none of the table's.
    const players = await listReports(test.db, admin, new URLSearchParams('target=player'));
    expect(players?.counts).toMatchObject({ all: 0, waiting: 0 });
    expect(players?.rows).toHaveLength(0);
    const oldest = await listReports(test.db, admin, new URLSearchParams('sort=filed&dir=asc'));
    expect(oldest?.sort).toEqual({ id: 'filed', dir: 'asc' });
  });

  it('moves a report from open to reviewing to resolved, once each', async () => {
    const table = await makeTable();
    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });
    const { id: reportId } = await reportRow();

    await startReview(test.db, admin, reportId);
    await expect(startReview(test.db, admin, reportId)).rejects.toBeInstanceOf(Invalid);
    await closeReport(test.db, admin, reportId, 'resolved', 'Mesa removida');
    await expect(closeReport(test.db, admin, reportId, 'dismissed', '')).rejects.toBeInstanceOf(
      Invalid,
    );

    expect(await reportRow()).toMatchObject({
      status: 'resolved',
      resolvedBy: admin.id,
      resolutionNote: 'Mesa removida',
    });
  });

  it('offers a ban for a player report, and closing the table for a table report', async () => {
    const table = await makeTable();
    await seat(table.id, id(2));
    await seat(table.id, id(3));
    await fileReport(test.db, member(2), table.slug, playerReport(id(3)));
    const { id: playerReportId } = await reportRow();

    const aboutPlayer = await reportDetail(test.db, admin, playerReportId);
    expect(aboutPlayer?.player).toMatchObject({ id: id(3) });
    expect(aboutPlayer?.reporter.id).toBe(id(2));
    expect(aboutPlayer?.can).toEqual({ review: true, close: true, closeTable: false, ban: true });

    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });
    const [tableReportRow] = await test.db
      .select()
      .from(reports)
      .where(eq(reports.targetType, 'table'));
    const aboutTable = await reportDetail(test.db, admin, tableReportRow.id);
    // Reporting a table bans no one from here: its GM is banned from their own page.
    expect(aboutTable?.can).toEqual({ review: true, close: true, closeTable: true, ban: false });
  });
});

describe('closeReportedTable', () => {
  it('closes the table with the justification, accepts the report and tells the GM', async () => {
    const table = await makeTable();
    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });
    const { id: reportId } = await reportRow();

    const eventIds = await closeReportedTable(
      test.db,
      admin,
      reportId,
      'Só divulgação de servidor.',
    );

    const [after] = await test.db.select().from(gameTables).where(eq(gameTables.id, table.id));
    expect(after).toMatchObject({
      status: 'disabled',
      moderationNote: 'Só divulgação de servidor.',
    });
    expect(await reportRow()).toMatchObject({ status: 'resolved' });
    const types = (await test.db.select().from(events))
      .filter((event) => eventIds.includes(event.id))
      .map((event) => event.type)
      .sort();
    expect(types).toEqual(['ReportResolved', 'TableClosedByModeration', 'TableDisabled']);

    const closure = await stored(eventIds.at(-1)!);
    await moderationHandler.handle(closure, test.db);
    const [notice] = await test.db.select().from(notifications);
    expect(notice).toMatchObject({
      recipientId: gm.id,
      type: 'moderation_notice',
      link: null,
    });
  });

  it('refuses a player report and a table that is already closed', async () => {
    const table = await makeTable();
    await seat(table.id, id(2));
    await fileReport(test.db, member(2), table.slug, playerReport(gm.id));
    const { id: reportId } = await reportRow();
    await expect(closeReportedTable(test.db, admin, reportId, 'x')).rejects.toBeInstanceOf(Invalid);

    const closed = await makeTable({ status: 'concluded' });
    await fileReport(test.db, member(3), closed.slug, { ...tableReport, details: '' });
    const [report] = await test.db.select().from(reports).where(eq(reports.tableId, closed.id));
    await expect(closeReportedTable(test.db, admin, report.id, 'x')).rejects.toBeInstanceOf(
      Invalid,
    );
  });
});

describe('banAccount', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  const week = new Date('2026-10-08T12:00:00Z');

  it('bans a GM: their open tables close and they leave the tables they play at', async () => {
    const open = await makeTable();
    const done = await makeTable({ status: 'concluded' });
    const elsewhere = await makeTable({ gmId: id(4) });
    await seat(elsewhere.id, gm.id);

    const eventIds = await banAccount(test.db, admin, gm.id, {
      until: week,
      reason: 'Assédio',
      now,
    });

    const [profile] = await test.db.select().from(profiles).where(eq(profiles.id, gm.id));
    expect(profile).toMatchObject({ status: 'suspended', bannedUntil: week, banReason: 'Assédio' });
    const [openNow] = await test.db.select().from(gameTables).where(eq(gameTables.id, open.id));
    const [doneNow] = await test.db.select().from(gameTables).where(eq(gameTables.id, done.id));
    expect(openNow.status).toBe('disabled');
    expect(doneNow.status).toBe('concluded');
    expect(
      await test.db.select().from(registrations).where(eq(registrations.playerId, gm.id)),
    ).toEqual([]);
    const types = (await test.db.select().from(events))
      .filter((event) => eventIds.includes(event.id))
      .map((event) => event.type);
    expect(types).toEqual(expect.arrayContaining(['TableDisabled', 'PlayerLeft', 'AccountBanned']));
  });

  it('accepts the player report it came from, and only for the reported player', async () => {
    const table = await makeTable();
    await seat(table.id, id(2));
    await seat(table.id, id(3));
    await fileReport(test.db, member(2), table.slug, playerReport(id(3)));
    const { id: reportId } = await reportRow();

    await expect(
      banAccount(test.db, admin, id(2), { until: null, reason: 'x', reportId, now }),
    ).rejects.toBeInstanceOf(Invalid);
    await banAccount(test.db, admin, id(3), { until: null, reason: 'Ofensas', reportId, now });

    expect(await reportRow()).toMatchObject({ status: 'resolved', resolutionNote: 'Ofensas' });
  });

  it('refuses members, oneself, other admins and an account already banned', async () => {
    const ban = { until: null, reason: 'x', now };
    await expect(banAccount(test.db, member(2), id(3), ban)).rejects.toBeInstanceOf(Forbidden);
    await expect(banAccount(test.db, admin, admin.id, ban)).rejects.toBeInstanceOf(Forbidden);
    await expect(banAccount(test.db, admin, otherAdmin.id, ban)).rejects.toBeInstanceOf(Forbidden);
    await banAccount(test.db, admin, id(5), ban);
    await expect(banAccount(test.db, admin, id(5), ban)).rejects.toBeInstanceOf(Invalid);
  });

  it('revokes a ban, leaving the tables it closed closed', async () => {
    const table = await makeTable();
    await banAccount(test.db, admin, gm.id, { until: null, reason: 'x', now });

    expect(await revokeBan(test.db, admin, gm.id)).toHaveLength(1);

    const [profile] = await test.db.select().from(profiles).where(eq(profiles.id, gm.id));
    expect(profile).toMatchObject({ status: 'active', bannedAt: null, banReason: null });
    const [after] = await test.db.select().from(gameTables).where(eq(gameTables.id, table.id));
    expect(after.status).toBe('disabled');
  });

  it('lifts a temporary ban once its time is up, never a permanent one', async () => {
    await banAccount(test.db, admin, id(5), { until: week, reason: 'x', now });
    await banAccount(test.db, admin, id(6), { until: null, reason: 'x', now });

    expect(await liftExpiredBans(test.db, new Date('2026-10-05T00:00:00Z'))).toEqual([]);
    expect(await liftExpiredBans(test.db, new Date('2026-10-09T00:00:00Z'))).toHaveLength(1);

    const rows = await test.db.select().from(profiles);
    expect(rows.find((row) => row.id === id(5))?.status).toBe('active');
    expect(rows.find((row) => row.id === id(6))?.status).toBe('suspended');
  });

  it('lets someone whose ban ran out back in on their next request', async () => {
    await banAccount(test.db, admin, id(5), { until: week, reason: 'x', now });
    const [profile] = await test.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id(5)));

    expect((await stillBanned(test.db, profile, now)).banned).toBe(true);
    expect((await stillBanned(test.db, profile, new Date('2026-10-09T00:00:00Z'))).banned).toBe(
      false,
    );
    expect(profile.status).toBe('active');
  });
});

describe('moderationOf', () => {
  it('counts the accepted reports against the tables someone runs', async () => {
    const accepted = await makeTable();
    const dismissed = await makeTable();
    await fileReport(test.db, member(2), accepted.slug, { ...tableReport, details: '' });
    await fileReport(test.db, member(2), dismissed.slug, { ...tableReport, details: '' });
    const rows = await test.db.select().from(reports);
    const of = (tableId: string) => rows.find((row) => row.tableId === tableId)!.id;
    await closeReportedTable(test.db, admin, of(accepted.id), 'x');
    await closeReport(test.db, admin, of(dismissed.id), 'dismissed', '');

    const moderation = await moderationOf(test.db, admin, gm.id);
    expect(moderation).toMatchObject({ canModerate: true, ban: null, acceptedTableReports: 1 });
  });
});

describe('auditLog', () => {
  it("records admins' decisions, and a table disabled by someone other than its GM", async () => {
    const byGm = await makeTable({ status: 'disabled' });
    await test.db.insert(events).values({
      type: 'TableDisabled',
      actorId: gm.id,
      payload: { tableId: byGm.id, slug: byGm.slug, title: byGm.title },
    });
    const byBan = await makeTable();
    await banAccount(test.db, admin, gm.id, { until: null, reason: 'x' });

    const log = await auditLog(test.db, admin, new URLSearchParams());
    const types = log!.rows.map((row) => row.type);
    expect(types).toContain('AccountBanned');
    // The ban closed the open table (an admin did it); the GM's own cancellation is not a decision.
    const disabled = log!.rows
      .filter((row) => row.type === 'TableDisabled')
      .map((row) => row.table);
    expect(disabled).toContain(byBan.title);
    expect(disabled).not.toContain(byGm.title);
    expect(log!.rows.find((row) => row.type === 'AccountBanned')).toMatchObject({
      by: 'admin',
      subject: 'm1',
    });
    expect(await auditLog(test.db, admin, new URLSearchParams('page=2'))).toBeNull();
    await expect(auditLog(test.db, member(2), new URLSearchParams())).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it('narrows the log to one kind of decision and to what the admin typed', async () => {
    await makeTable();
    await banAccount(test.db, admin, gm.id, { until: null, reason: 'x' });

    const accounts = await auditLog(test.db, admin, new URLSearchParams('kind=accounts'));
    expect(accounts!.rows.map((row) => row.type)).toEqual(['AccountBanned']);
    expect(accounts!.total).toBe(1);
    const tables = await auditLog(test.db, admin, new URLSearchParams('kind=tables'));
    expect(tables!.rows.every((row) => row.type === 'TableDisabled')).toBe(true);
    // The admin who decided is found by their @, with or without it.
    const byAdmin = await auditLog(test.db, admin, new URLSearchParams('q=@admin'));
    expect(byAdmin!.total).toBeGreaterThan(0);
    const nobody = await auditLog(test.db, admin, new URLSearchParams('q=ninguem-assim'));
    expect(nobody!.total).toBe(0);
    expect(nobody!.rows).toEqual([]);
  });
});

describe('moderationHandler', () => {
  it('tells every active admin about a new report, and nobody else', async () => {
    await test.db
      .update(profiles)
      .set({ status: 'suspended' })
      .where(eq(profiles.id, id(91)));
    const table = await makeTable();
    const { eventId } = await fileReport(test.db, member(2), table.slug, {
      ...tableReport,
      details: '',
    });

    const event = await stored(eventId);
    await moderationHandler.handle(event, test.db);
    await moderationHandler.handle(event, test.db);

    const rows = await test.db.select().from(notifications);
    expect(rows.map((row) => row.recipientId)).toEqual([admin.id]);
    expect(rows[0]).toMatchObject({ type: 'report_filed_admin', actorId: null });
  });

  it('tells the reporter their report was closed', async () => {
    const table = await makeTable();
    await fileReport(test.db, member(2), table.slug, { ...tableReport, details: '' });
    const { id: reportId } = await reportRow();

    const eventId = await closeReport(test.db, admin, reportId, 'dismissed', '');
    await moderationHandler.handle(await stored(eventId), test.db);

    const rows = await test.db.select().from(notifications);
    expect(rows.map((row) => [row.recipientId, row.type])).toEqual([[id(2), 'report_resolved']]);
  });
});
