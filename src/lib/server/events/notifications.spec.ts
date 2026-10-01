import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gameTables, notifications, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { notificationHandler } from './notifications';
import type { DomainEvent, StoredEvent } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000a01';
const ana = '00000000-0000-4000-8000-000000000a02';
const bia = '00000000-0000-4000-8000-000000000a03';
const caio = '00000000-0000-4000-8000-000000000a04';
const tableId = '00000000-0000-4000-8000-000000000a10';
const table = { tableId, slug: 'mesa', title: 'Mesa do Dragão' };
// Registration events carry no title: the handler reads it from the table.
const seat = { tableId, slug: table.slug };
let sequence = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre' },
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
    { id: caio, username: 'caio' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    id: tableId,
    slug: table.slug,
    systemId: system.id,
    title: table.title,
    kind: 'one_shot',
    capacity: 4,
    startsAt: new Date('2026-10-10T22:00:00Z'),
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
  });
  await test.db.insert(registrations).values([
    { tableId, playerId: ana, status: 'confirmed' },
    { tableId, playerId: bia, status: 'confirmed' },
    // A pending request has no seat, so nothing about the table reaches it.
    { tableId, playerId: caio, status: 'pending' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
});

const stored = (event: DomainEvent, actorId: string): StoredEvent => ({
  ...event,
  id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  actorId,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  attempts: 0,
});

const handle = (event: StoredEvent) => notificationHandler.handle(event, test.db);

const written = async () =>
  (await test.db.select().from(notifications)).map((row) => ({
    to: row.recipientId,
    type: row.type,
    category: row.category,
    link: row.link,
  }));

describe('notificationHandler', () => {
  it.each([
    ['TableUpdated', 'table_updated', 'table', '/tables/mesa'],
    ['TableDisabled', 'table_cancelled', 'table', null],
  ] as const)(
    '%s tells the confirmed players, not the GM or a pending request',
    async (type, kind, category, link) => {
      await handle(stored({ type, payload: table }, gm));

      expect(await written()).toEqual(
        expect.arrayContaining([
          { to: ana, type: kind, category, link },
          { to: bia, type: kind, category, link },
        ]),
      );
      expect(await written()).toHaveLength(2);
    },
  );

  it.each([
    ['JoinRequested', caio, gm, 'join_requested', '/tables/mesa/manage'],
    ['PlayerJoined', ana, gm, 'player_joined', '/tables/mesa/manage'],
    ['JoinApproved', gm, caio, 'join_approved', '/tables/mesa'],
    ['JoinDeclined', gm, caio, 'join_declined', '/tables'],
  ] as const)('%s by %s tells %s', async (type, actor, recipient, kind, link) => {
    const player = actor === gm ? recipient : actor;
    await handle(stored({ type, payload: { ...seat, playerId: player } }, actor));

    expect(await written()).toEqual([
      { to: recipient, type: kind, category: 'registration', link },
    ]);
  });

  it('tells the GM when a player leaves, and the player when the GM removes them', async () => {
    await handle(
      stored({ type: 'PlayerLeft', payload: { ...seat, playerId: ana, reason: 'left' } }, ana),
    );
    await handle(
      stored({ type: 'PlayerLeft', payload: { ...seat, playerId: bia, reason: 'removed' } }, gm),
    );

    expect(await written()).toEqual(
      expect.arrayContaining([
        { to: gm, type: 'player_left', category: 'registration', link: '/tables/mesa/manage' },
        { to: bia, type: 'player_removed', category: 'registration', link: '/tables' },
      ]),
    );
  });

  it('tells the GM about a new rating', async () => {
    await handle(stored({ type: 'RatingSubmitted', payload: { ...seat, playerId: ana } }, ana));

    expect(await written()).toEqual([
      { to: gm, type: 'rating_received', category: 'rating', link: '/tables/mesa' },
    ]);
  });

  it('keeps who did it and the table facts the wording needs', async () => {
    await handle(stored({ type: 'JoinRequested', payload: { ...seat, playerId: caio } }, caio));

    const [row] = await test.db.select().from(notifications);
    expect(row).toMatchObject({ actorId: caio, metadata: table, readAt: null });
  });

  it('never tells people about what they did themselves', async () => {
    // An admin who is also seated edits the table: the other player hears of it, the editor does not.
    await handle(stored({ type: 'TableUpdated', payload: table }, ana));

    expect((await written()).map((row) => row.to)).toEqual([bia]);
  });

  it('adds nothing when the same event is handled again', async () => {
    const event = stored({ type: 'TableUpdated', payload: table }, gm);
    await handle(event);
    await handle(event);

    expect(await written()).toHaveLength(2);
  });

  it('asks the GM, and only the GM, whether a session that is over happened', async () => {
    const event = {
      ...stored({ type: 'TableAwaitingConfirmation', payload: table }, gm),
      actorId: null,
    };
    await handle(event);
    await handle(event);

    expect(await written()).toEqual([
      expect.objectContaining({
        to: gm,
        type: 'session_confirmation',
        link: '/tables/mesa/manage',
      }),
    ]);
  });

  it('invites the confirmed players, not a pending request, to rate once the GM says it happened', async () => {
    await handle(stored({ type: 'TableConcluded', payload: table }, gm));

    const rows = await written();
    expect(rows.map((row) => row.to).sort()).toEqual([ana, bia].sort());
    expect(rows.every((row) => row.type === 'rating_prompt' && row.link === '/tables/mesa')).toBe(
      true,
    );
  });
});
