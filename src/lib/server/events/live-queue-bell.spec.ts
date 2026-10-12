import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { registerLiveQueue } from '@mesaaberta/core/server/events/live-queue';
import { events, gameTables, notifications, profiles, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Logger } from '../logger';
import { dispatchEvent } from './dispatcher';
import { createEventExecutor } from './executor';
import { bellHandlers } from './handlers';
import { recordEvent } from './outbox';
import type { Handler } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-12T12:00:00Z');
const gm = '00000000-0000-4000-8000-000000000b01';
const ana = '00000000-0000-4000-8000-000000000b02';
const tableId = '00000000-0000-4000-8000-000000000b10';
const log = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;
const names = bellHandlers.map(({ name }) => name);

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre' },
    { id: ana, username: 'ana' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    id: tableId,
    slug: 'mesa',
    systemId: system.id,
    title: 'Mesa do Dragão',
    kind: 'one_shot',
    capacity: 4,
    startsAt: new Date('2026-10-20T22:00:00Z'),
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
  });
});
afterAll(() => test.close());

describe('the bell on the queue', () => {
  it('names the four handlers that write notifications', () => {
    expect(names).toEqual([
      'in-app-notifications-v1',
      'system-announcements-v1',
      'moderation-notifications-v1',
      'catalog-notifications-v1',
    ]);
  });

  it('writes the notification once: not in the request, then by the consumer, never twice', async () => {
    const mail = vi.fn(async () => {});
    const handlers: Handler[] = [
      { name: 'mail', types: ['JoinRequested'], handle: mail },
      ...bellHandlers,
    ];
    const send = vi.fn(async () => {});
    registerLiveQueue(test.db, async () => ({ queue: { send }, handlers: names }));
    const id = await recordEvent(
      test.db,
      { type: 'JoinRequested', actorId: ana, payload: { tableId, slug: 'mesa', playerId: ana } },
      { now: t0 },
    );
    const bell = () =>
      test.db.select().from(notifications).where(eq(notifications.recipientId, gm));

    // The request runs the mail and hands the bell over.
    expect(await dispatchEvent(test.db, handlers, id, t0, log)).toEqual({ status: 'deferred' });
    expect(mail).toHaveBeenCalledOnce();
    expect(await bell()).toHaveLength(0);
    expect(send).toHaveBeenCalledOnce();

    // The consumer finishes it; a duplicate delivery adds nothing.
    const execute = createEventExecutor(test.db, handlers, {
      log,
      options: { only: names, fenced: true },
    });
    const reference = { eventId: id, type: 'JoinRequested', version: 1 } as const;
    expect(await execute(reference)).toEqual({ status: 'done' });
    expect(await execute(reference)).toEqual({ status: 'done' });

    expect(await bell()).toHaveLength(1);
    expect(mail).toHaveBeenCalledOnce();
    const [row] = await test.db.select().from(events).where(eq(events.id, id));
    expect(row.handledBy).toEqual(['mail', 'in-app-notifications-v1']);
    expect(row.processedAt).not.toBeNull();
  });
});
