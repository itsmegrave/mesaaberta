import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, notifications, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden, Invalid } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';
import type { Actor } from '../auth/policy';
import type { StoredEvent } from '../events/types';
import {
  audienceSizes,
  findRecipient,
  listAnnouncements,
  searchRecipients,
  sendAnnouncement,
  type AnnouncementDraft,
} from './announcements';
import { listNotifications } from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-000000000d01';
const gm = '00000000-0000-4000-8000-000000000d02';
const player = '00000000-0000-4000-8000-000000000d03';
const waiting = '00000000-0000-4000-8000-000000000d04';
const suspended = '00000000-0000-4000-8000-000000000d05';
const tableId = '00000000-0000-4000-8000-000000000d10';

const adminActor: Actor = { id: admin, role: 'admin', status: 'active' };
const member: Actor = { id: gm, role: 'member', status: 'active' };
const handlers = handlersFor(undefined);

const draft = (over: Partial<AnnouncementDraft> = {}): AnnouncementDraft => ({
  title: 'Manutenção no sábado',
  body: 'A plataforma fica fora do ar das 2h às 4h.',
  icon: '',
  tone: 'warning',
  audience: 'all_active_users',
  recipient: '',
  link: '/changelog',
  confirmed: true,
  ...over,
});

/** Sends and delivers, as the page does (the handler runs after the response). */
async function send(over: Partial<AnnouncementDraft> = {}) {
  const result = await sendAnnouncement(test.db, adminActor, draft(over));
  if (result.step === 'sent') await dispatchEvent(test.db, handlers, result.eventId);
  return result;
}

const bells = async () =>
  (await test.db.select().from(notifications)).map((row) => row.recipientId).sort();

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: gm, username: 'mestra-ana' },
    { id: player, username: 'bruno' },
    { id: waiting, username: 'caio' },
    { id: suspended, username: 'suspensa', status: 'suspended' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    id: tableId,
    slug: 'mesa',
    systemId: system.id,
    title: 'Mesa',
    kind: 'one_shot',
    capacity: 4,
    startsAt: new Date('2026-10-10T22:00:00Z'),
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
  });
  await test.db.insert(registrations).values([
    { tableId, playerId: player, status: 'confirmed' },
    // A request is not a seat: not an active player.
    { tableId, playerId: waiting, status: 'pending' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(events);
});

describe('sendAnnouncement', () => {
  it('refuses anyone who is not an admin, and records nothing', async () => {
    await expect(sendAnnouncement(test.db, member, draft())).rejects.toBeInstanceOf(Forbidden);
    await expect(sendAnnouncement(test.db, null, draft())).rejects.toBeInstanceOf(Forbidden);
    expect(await test.db.select().from(events)).toHaveLength(0);
  });

  it('first only counts who it reaches, sending nothing until confirmed', async () => {
    const result = await sendAnnouncement(test.db, adminActor, draft({ confirmed: false }));

    expect(result).toEqual({ step: 'confirm', count: 4, recipient: null });
    expect(await test.db.select().from(events)).toHaveLength(0);
  });

  it('puts it in the bell of every active person, with its icon, as a system announcement', async () => {
    const result = await send();

    expect(result).toMatchObject({ step: 'sent', count: 4 });
    expect(await bells()).toEqual([admin, gm, player, waiting].sort());
    const [row] = await test.db.select().from(notifications).limit(1);
    expect(row).toMatchObject({
      category: 'system',
      type: 'system_announcement',
      // No icon picked: the warning's.
      icon: 'alert-triangle',
      title: 'Manutenção no sábado',
      body: 'A plataforma fica fora do ar das 2h às 4h.',
      link: '/changelog',
      actorId: null,
      metadata: { tone: 'warning' },
    });
  });

  it('keeps the icon the admin picked', async () => {
    await send({ icon: 'gift', audience: 'specific_user', recipient: 'bruno' });

    const [row] = await test.db.select().from(notifications);
    expect(row.icon).toBe('gift');
    // And the bell shows it, worded by its title and body.
    const [shown] = await listNotifications(test.db, player);
    expect(shown).toMatchObject({ icon: 'gift', title: 'Manutenção no sábado', read: false });
  });

  it.each([
    ['game_masters', [gm]],
    ['active_players', [player]],
  ] as const)('reaches only %s', async (audience, expected) => {
    const result = await send({ audience });

    expect(result.count).toBe(expected.length);
    expect(await bells()).toEqual([...expected]);
  });

  it('reaches one person, named by username (with or without @) or by id', async () => {
    for (const recipient of ['@Bruno', player]) {
      await test.db.delete(notifications);
      await send({ audience: 'specific_user', recipient });
      expect(await bells()).toEqual([player]);
    }
  });

  it('refuses a recipient who does not exist or is suspended', async () => {
    for (const recipient of ['ninguem', 'suspensa', '00000000-0000-4000-8000-000000000fff']) {
      await expect(
        sendAnnouncement(test.db, adminActor, draft({ audience: 'specific_user', recipient })),
      ).rejects.toMatchObject(new Invalid('recipient', 'not_found'));
    }
  });

  it('never reaches a suspended account', async () => {
    await send();
    expect(await bells()).not.toContain(suspended);
  });

  it('delivers once, however many times the handler runs', async () => {
    const result = await send();
    if (result.step !== 'sent') throw new Error('not sent');
    const [event] = await test.db.select().from(events).where(eq(events.id, result.eventId));
    const handler = handlers.find((h) => h.name === 'system-announcements-v1')!;

    const again = {
      id: event.id,
      type: 'SystemAnnouncementSent',
      payload: event.payload,
      actorId: event.actorId,
      createdAt: event.createdAt,
      attempts: 1,
    } as StoredEvent;
    await handler.handle(again, test.db);

    expect(await bells()).toHaveLength(4);
  });

  it('records who sent it and what, for the audit log', async () => {
    const result = await send({ confirmed: true });
    if (result.step !== 'sent') throw new Error('not sent');

    const [event] = await test.db.select().from(events).where(eq(events.id, result.eventId));
    expect(event).toMatchObject({ type: 'SystemAnnouncementSent', actorId: admin });
    expect(event.payload).toMatchObject({
      title: 'Manutenção no sábado',
      audience: 'all_active_users',
      recipientId: null,
      estimated: 4,
    });
    expect(event.processedAt).not.toBeNull();
  });
});

describe('listAnnouncements', () => {
  it('shows what was sent, by whom, to whom, how many bells it reached and whether it went out', async () => {
    await send({ audience: 'specific_user', recipient: 'bruno', title: 'Só para você' });
    // Recorded but not yet delivered.
    await sendAnnouncement(test.db, adminActor, draft({ title: 'Na fila' }));

    const [pending, delivered] = await listAnnouncements(test.db);

    expect(pending).toMatchObject({ title: 'Na fila', status: 'pending', notified: 0 });
    expect(delivered).toMatchObject({
      title: 'Só para você',
      icon: 'alert-triangle',
      audience: 'specific_user',
      recipient: 'bruno',
      author: 'admin',
      notified: 1,
      status: 'delivered',
    });
  });

  it('leaves out every other event', async () => {
    await test.db.insert(events).values({ type: 'TableCreated', actorId: gm, payload: {} });
    expect(await listAnnouncements(test.db)).toEqual([]);
  });
});

describe('audienceSizes', () => {
  it('counts each broad audience among active accounts', async () => {
    expect(await audienceSizes(test.db)).toEqual({
      all_active_users: 4,
      game_masters: 1,
      active_players: 1,
    });
  });
});

describe('recipients', () => {
  it('finds an active person by username or id, and nobody for anything else', async () => {
    expect(await findRecipient(test.db, ' @BRUNO ')).toEqual({ id: player, username: 'bruno' });
    expect(await findRecipient(test.db, gm)).toEqual({ id: gm, username: 'mestra-ana' });
    expect(await findRecipient(test.db, 'suspensa')).toBeNull();
    expect(await findRecipient(test.db, '')).toBeNull();
  });

  it('suggests active usernames that start with what was typed, and treats wildcards as nothing', async () => {
    expect(await searchRecipients(test.db, '@mes')).toEqual([{ id: gm, username: 'mestra-ana' }]);
    expect(await searchRecipients(test.db, 'su')).toEqual([]);
    expect(await searchRecipients(test.db, '%')).toEqual([]);
    expect(await searchRecipients(test.db, '_')).toEqual([]);
  });
});
