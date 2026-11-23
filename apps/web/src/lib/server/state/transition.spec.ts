import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import { events, profiles, reports } from '@mesaaberta/core/server/db/schema';
import { reportMachine } from '@mesaaberta/core/moderation/report-machine';
import { applyTransition } from '@mesaaberta/core/server/state/transition';

let test: Awaited<ReturnType<typeof createTestDb>>;
const reporter = '00000000-0000-4000-8000-000000000a01';
const target = '00000000-0000-4000-8000-000000000a02';
let reportId: string;

const review = (from: 'open' | 'reviewing' = 'open') =>
  applyTransition(test.db, {
    table: reports,
    status: reports.status,
    where: eq(reports.id, reportId),
    machine: reportMachine,
    from,
    event: 'REVIEW',
    record: { type: 'ReportReviewing', actorId: null, payload: { reportId, reporterId: reporter } },
  });
const statusNow = async () =>
  (
    await test.db.select({ status: reports.status }).from(reports).where(eq(reports.id, reportId))
  )[0].status;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: reporter, username: 'quem-denuncia' },
    { id: target, username: 'alvo' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(reports);
  await test.db.delete(events);
  [{ id: reportId }] = await test.db
    .insert(reports)
    .values({ reporterId: reporter, targetType: 'person', targetId: target, reason: 'spam' })
    .returning({ id: reports.id });
});

describe('applyTransition', () => {
  it('moves the row the machine allows, with its other columns and its event', async () => {
    const at = new Date('2026-11-23T12:00:00Z');
    const moved = await applyTransition(test.db, {
      table: reports,
      status: reports.status,
      where: eq(reports.id, reportId),
      machine: reportMachine,
      from: ['open', 'reviewing'],
      event: 'DISMISS',
      set: { resolvedAt: at },
      record: (to) => ({
        type: 'ReportDismissed',
        actorId: null,
        payload: { reportId, reporterId: reporter, to },
      }),
    });

    expect(moved).toMatchObject({ to: 'dismissed', count: 1, eventId: expect.any(String) });
    const [row] = await test.db.select().from(reports).where(eq(reports.id, reportId));
    expect(row).toMatchObject({ status: 'dismissed', resolvedAt: at });
    const [event] = await test.db.select().from(events);
    expect(event).toMatchObject({ type: 'ReportDismissed', payload: { to: 'dismissed' } });
  });

  it('answers null and records nothing when the row already left that status', async () => {
    await review();

    expect(await review()).toBeNull();
    expect(await statusNow()).toBe('reviewing');
    expect(await test.db.select().from(events)).toHaveLength(1);
  });

  it('lets only one of two moves at once win', async () => {
    const results = await Promise.all([review(), review()]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await test.db.select().from(events)).toHaveLength(1);
  });

  it('throws on a move the machine does not have, before touching the row', async () => {
    await expect(review('reviewing')).rejects.toThrow('no single move REVIEW from reviewing');
    expect(await statusNow()).toBe('open');
  });
});
