import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  profiles,
  registrations,
  conversations,
  conversationMembers,
  messages,
  playerInvitations,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { createTable, publishTable } from '@mesaaberta/core/server/tables/write';
import { deleteDraftTable, closeTable } from '@mesaaberta/core/server/tables/end';
import { invitePlayer } from '@mesaaberta/core/server/invitations/service';
import { duplicateTable } from '@mesaaberta/core/server/tables/duplicate';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const actor: Actor = {
  id: '00000000-0000-4000-8000-000000000101',
  role: 'member',
  status: 'active',
};
const other: Actor = {
  id: '00000000-0000-4000-8000-000000000102',
  role: 'admin',
  status: 'active',
};
const player: Actor = {
  id: '00000000-0000-4000-8000-000000000103',
  role: 'member',
  status: 'active',
};
const input = (over: Partial<TableInput> = {}): TableInput => ({
  systemSlug: 'daggerheart',
  title: 'Fonte',
  description: '<p>Uma aventura</p>',
  extraInfo: '<p>Extras</p>',
  welcomeMessage: '<p>Bem-vindo</p>',
  kind: 'one_shot',
  capacity: 5,
  minPlayers: 3,
  plannedSessions: null,
  startsAtLocal: '2026-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: 240,
  recurrence: null,
  untilLocalDate: null,
  joinMode: 'approval',
  modality: 'online',
  locationArea: null,
  joinDetails: '<p>Privado</p>',
  postalCode: null,
  locationNeighbourhood: null,
  locationCity: null,
  locationState: null,
  platforms: [],
  tags: [],
  removeImage: false,
  ...over,
});
const row = async (slug: string) =>
  (await test.db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0];
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: actor.id, username: 'duplicate-gm' },
    { id: other.id, username: 'duplicate-admin', role: 'admin' },
    { id: player.id, username: 'seated-player' },
  ]);
});
afterAll(() => test.close());
beforeEach(() => test.db.delete(events));
const source = () =>
  createTable(test.db, actor, input({ startsAtLocal: '2099-01-01T19:00' }), {
    now,
    draft: true,
    imagePath: 'tables/original.png',
  });

describe('ending an owned table', () => {
  it('permanently removes a draft and its conversation while copies keep the shared image', async () => {
    const original = await source();
    const originalRow = await row(original.slug);
    const [chat] = await test.db
      .select()
      .from(conversations)
      .where(eq(conversations.tableId, originalRow.id));
    await test.db.insert(messages).values({
      conversationId: chat.id,
      senderId: actor.id,
      body: 'Conteúdo privado do rascunho',
    });
    const copy = await duplicateTable(
      test.db,
      actor,
      original.slug,
      input({ startsAtLocal: '2099-01-02T19:00' }),
      { draft: true },
    );
    const result = await deleteDraftTable(test.db, actor, original.slug);
    expect(result.eventIds).toHaveLength(1);
    expect(await row(original.slug)).toBeUndefined();
    expect(
      await test.db.select().from(conversations).where(eq(conversations.tableId, originalRow.id)),
    ).toEqual([]);
    expect(
      await test.db.select().from(messages).where(eq(messages.conversationId, chat.id)),
    ).toEqual([]);
    expect(
      await test.db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, chat.id)),
    ).toEqual([]);
    expect(await row(copy.slug)).toMatchObject({
      duplicatedFromTableId: null,
      imagePath: 'tables/original.png',
    });
    const [event] = await test.db.select().from(events).where(eq(events.id, result.eventIds[0]));
    expect(event).toMatchObject({
      type: 'TableDraftDeleted',
      payload: { tableId: originalRow.id },
    });
    expect(event.payload).not.toHaveProperty('title');
    const audit = await test.db.select().from(events).where(eq(events.actorId, actor.id));
    expect(
      audit
        .filter((entry) => (entry.payload as { tableId?: string }).tableId === originalRow.id)
        .every((entry) => Object.keys(entry.payload as object).length === 1),
    ).toBe(true);
  });
  it('refuses another owner, including an administrator, and refuses deleting a published table', async () => {
    const original = await source();
    await expect(deleteDraftTable(test.db, other, original.slug)).rejects.toMatchObject({
      name: 'Forbidden',
    });
    await expect(
      deleteDraftTable(test.db, { ...actor, status: 'suspended' }, original.slug),
    ).rejects.toMatchObject({ name: 'Forbidden' });
    await publishTable(test.db, actor, original.slug);
    await expect(deleteDraftTable(test.db, actor, original.slug)).rejects.toMatchObject({
      message: 'not_a_draft',
    });
    expect(await row(original.slug)).toMatchObject({ status: 'active' });
  });
  it('closes once, removes pending requests, preserves confirmed history and emits one cancellation', async () => {
    const original = await source();
    await publishTable(test.db, actor, original.slug);
    const table = await row(original.slug);
    await test.db.insert(registrations).values([
      { tableId: table.id, playerId: other.id, status: 'pending' },
      { tableId: table.id, playerId: player.id, status: 'confirmed' },
    ]);
    await expect(closeTable(test.db, other, original.slug)).rejects.toMatchObject({
      name: 'Forbidden',
    });
    const closed = await closeTable(test.db, actor, original.slug);
    expect(closed.eventIds).toHaveLength(1);
    expect(await closeTable(test.db, actor, original.slug)).toEqual({
      eventIds: [],
      slug: original.slug,
    });
    expect(await row(original.slug)).toMatchObject({ status: 'disabled', icalSequence: 1 });
    expect(
      await test.db.select().from(registrations).where(eq(registrations.tableId, table.id)),
    ).toMatchObject([{ playerId: player.id, status: 'confirmed' }]);
    const [event] = await test.db.select().from(events).where(eq(events.id, closed.eventIds[0]));
    expect(event).toMatchObject({
      type: 'TableDisabled',
      payload: { cancelledRequestPlayerIds: [other.id] },
    });
  });
  it('cancels pending invitations and returns their events for immediate notification dispatch', async () => {
    const original = await source();
    await publishTable(test.db, actor, original.slug);
    const invitation = await invitePlayer(test.db, actor, original.slug, other.id);
    const closed = await closeTable(test.db, actor, original.slug);
    expect(closed.eventIds).toHaveLength(2);
    const [saved] = await test.db
      .select()
      .from(playerInvitations)
      .where(eq(playerInvitations.id, invitation.invitationId));
    expect(saved).toMatchObject({ status: 'cancelled', cancellationReason: 'table_disabled' });
    const emitted = await test.db.select().from(events);
    expect(
      emitted
        .filter((entry) => closed.eventIds.includes(entry.id))
        .map((entry) => entry.type)
        .sort(),
    ).toEqual(['InvitationCancelled', 'TableDisabled']);
    expect(await closeTable(test.db, actor, original.slug)).toEqual({
      slug: original.slug,
      eventIds: [],
    });
  });
  it.each(['draft', 'concluded', 'not_held'] as const)(
    'preserves %s instead of treating it as an active closure',
    async (status) => {
      const original = await source();
      await test.db.update(gameTables).set({ status }).where(eq(gameTables.slug, original.slug));
      await expect(closeTable(test.db, actor, original.slug)).rejects.toMatchObject({
        name: 'Invalid',
      });
      expect(await row(original.slug)).toMatchObject({ status });
    },
  );
});
