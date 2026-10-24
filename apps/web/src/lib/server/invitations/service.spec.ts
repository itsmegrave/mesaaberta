import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  gmInviteBlocks,
  profiles,
  registrations,
  systems,
  playerInvitations,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  invitePlayer,
  respondToInvitation,
  cancelInvitation,
  setInvitationsEnabled,
  setGmInviteBlock,
  expireInvitations,
  invitationPreferences,
  loadInvitation,
} from '@mesaaberta/core/server/invitations/service';
import { seatAvailability } from '@mesaaberta/core/server/invitations/seats';
import {
  joinTable,
  leaveTable,
  approveRegistration,
} from '@mesaaberta/core/server/registrations/service';
import { postponeTable } from '@mesaaberta/core/server/tables/lifecycle';
import { loadTableForEdit, updateTable, disableTable } from '@mesaaberta/core/server/tables/write';
import { tableFormSchema, toTableInput } from '@mesaaberta/core/tables/schema';
import {
  exportAccount,
  closeAccount,
  anonymiseProfile,
} from '@mesaaberta/core/server/account/service';
import { banAccount, closeTableByAdmin } from '@mesaaberta/core/server/moderation/admin';
import { findTableBySlug } from '@mesaaberta/core/server/tables/queries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000090${String(n).padStart(2, '0')}`;
const actor = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const now = new Date('2030-01-01T00:00:00Z');
let seq = 0;
beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values(Array.from({ length: 12 }, (_, i) => ({ id: id(i + 1), username: `invite${i + 1}` })));
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.update(profiles).set({ status: 'active' });
  await test.db.delete(playerInvitations);
  await test.db.delete(events);
  await setInvitationsEnabled(test.db, actor(2), true);
  await setGmInviteBlock(test.db, actor(2), id(1), false);
});
const table = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select().from(systems).limit(1);
  const [t] = await test.db
    .insert(gameTables)
    .values({
      slug: `invite-${++seq}`,
      title: 'Mesa',
      gmId: id(1),
      systemId: system.id,
      kind: 'one_shot',
      capacity: 1,
      startsAt: new Date('2030-01-04T00:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      ...over,
    })
    .returning();
  return t;
};
const invite = (slug: string, p = 2, date = now) =>
  invitePlayer(test.db, actor(1), slug, id(p), { now: date });

describe('player invitations', () => {
  it('reserves the last seat publicly without creating registration or exposing recipient', async () => {
    const t = await table();
    await invite(t.slug);
    expect(await seatAvailability(test.db, t.id, now)).toEqual({
      confirmed: 0,
      reserved: 1,
      available: 0,
    });
    expect(
      await test.db.select().from(registrations).where(eq(registrations.tableId, t.id)),
    ).toEqual([]);
    expect(await findTableBySlug(test.db, t.slug, now)).toMatchObject({
      taken: 0,
      reserved: 1,
      seatsLeft: 0,
    });
    await expect(joinTable(test.db, actor(3), t.slug, { now })).rejects.toMatchObject({
      name: 'TableFull',
    });
  });
  it('atomically exchanges its last reservation for a confirmed seat once', async () => {
    const t = await table({ joinMode: 'approval' });
    const i = await invite(t.slug);
    expect(
      await respondToInvitation(test.db, actor(2), i.invitationId, 'accept', { now }),
    ).toMatchObject({ status: 'accepted' });
    expect(await seatAvailability(test.db, t.id, now)).toEqual({
      confirmed: 1,
      reserved: 0,
      available: 0,
    });
    expect(await respondToInvitation(test.db, actor(2), i.invitationId, 'accept', { now })).toEqual(
      { status: 'accepted', eventIds: [] },
    );
    expect(
      (await test.db.select().from(events)).filter((e) => e.type === 'PlayerJoined'),
    ).toHaveLength(1);
  });
  it.each(['auto', 'approval'] as const)(
    'keeps refusal durable after outbox pruning and a voluntary %s join/leave',
    async (joinMode) => {
      const t = await table({ joinMode });
      const i = await invite(t.slug);
      await respondToInvitation(test.db, actor(2), i.invitationId, 'decline', { now });
      await test.db.delete(events);
      await joinTable(test.db, actor(2), t.slug, { now });
      await leaveTable(test.db, actor(2), t.slug);
      await expect(invite(t.slug)).rejects.toMatchObject({ name: 'Invalid', field: 'invitation' });
    },
  );
  it('does not replace requests or let approvals consume reserved seats', async () => {
    const t = await table({ capacity: 2, joinMode: 'approval' });
    await joinTable(test.db, actor(3), t.slug, { now });
    await expect(invite(t.slug, 3)).rejects.toMatchObject({ name: 'Invalid' });
    await invite(t.slug);
    await invite(t.slug, 4);
    await expect(approveRegistration(test.db, actor(1), t.slug, id(3))).rejects.toMatchObject({
      name: 'TableFull',
    });
  });
  it('expires exactly at the deadline and permits a new id without the cron', async () => {
    const t = await table();
    const first = await invite(t.slug);
    const deadline = new Date('2030-01-03T00:00:00Z');
    expect(await seatAvailability(test.db, t.id, deadline)).toEqual({
      confirmed: 0,
      reserved: 0,
      available: 1,
    });
    const second = await invite(t.slug, 2, deadline);
    expect(second.invitationId).not.toBe(first.invitationId);
    expect(
      await respondToInvitation(test.db, actor(2), first.invitationId, 'accept', { now: deadline }),
    ).toMatchObject({ status: 'expired' });
    expect((await loadInvitation(test.db, actor(2), second.invitationId)).status).toBe('pending');
  });
  it('caps the deadline at start and makes late acceptance expire', async () => {
    const t = await table({ startsAt: new Date('2030-01-01T01:00:00Z') });
    const i = await invite(t.slug);
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).expiresAt).toEqual(t.startsAt);
    expect(
      await respondToInvitation(test.db, actor(2), i.invitationId, 'accept', { now: t.startsAt }),
    ).toMatchObject({ status: 'expired' });
    expect((await expireInvitations(test.db, { now: t.startsAt })).processed).toBe(0);
  });
  it('only lets the owner invite and only the recipient decide or read', async () => {
    const t = await table();
    await expect(invitePlayer(test.db, actor(3), t.slug, id(2), { now })).rejects.toMatchObject({
      name: 'Forbidden',
    });
    await expect(invite(t.slug, 1)).rejects.toMatchObject({ name: 'Invalid' });
    const i = await invite(t.slug);
    await expect(
      respondToInvitation(test.db, actor(3), i.invitationId, 'accept', { now }),
    ).rejects.toMatchObject({ name: 'NotFound' });
    await expect(loadInvitation(test.db, actor(3), i.invitationId)).rejects.toMatchObject({
      name: 'NotFound',
    });
  });
  it('cancellation is final and never allows an old link to consume a later reservation', async () => {
    const t = await table();
    const i = await invite(t.slug);
    await cancelInvitation(test.db, actor(1), i.invitationId, { now });
    await invite(t.slug);
    expect(await respondToInvitation(test.db, actor(2), i.invitationId, 'accept', { now })).toEqual(
      { status: 'cancelled', eventIds: [] },
    );
    expect(await seatAvailability(test.db, t.id, now)).toMatchObject({ reserved: 1, confirmed: 0 });
  });
  it('opt-out cancels pending reservations but preserves confirmed seats and spontaneous joining', async () => {
    const t = await table({ capacity: 2 });
    await invite(t.slug);
    await joinTable(test.db, actor(3), t.slug, { now });
    await setInvitationsEnabled(test.db, actor(2), false, { now });
    expect(await seatAvailability(test.db, t.id, now)).toEqual({
      confirmed: 1,
      reserved: 0,
      available: 1,
    });
    await expect(invite(t.slug)).rejects.toMatchObject({ name: 'Invalid', message: 'unavailable' });
    await joinTable(test.db, actor(2), t.slug, { now });
    expect(await invitationPreferences(test.db, actor(2))).toMatchObject({ enabled: false });
  });
  it('GM block cancels only that GM and unblock never resurrects reservations', async () => {
    const t = await table();
    const other = await table({ gmId: id(4) });
    await invite(t.slug);
    await invitePlayer(test.db, actor(4), other.slug, id(2), { now });
    await setGmInviteBlock(test.db, actor(2), id(1), true, { now });
    expect(await seatAvailability(test.db, t.id, now)).toMatchObject({ reserved: 0 });
    expect(await seatAvailability(test.db, other.id, now)).toMatchObject({ reserved: 1 });
    await setGmInviteBlock(test.db, actor(2), id(1), false, { now });
    expect(await seatAvailability(test.db, t.id, now)).toMatchObject({ reserved: 0 });
  });
  it('rejects unavailable identities without revealing invitation preferences', async () => {
    const t = await table();
    await test.db
      .update(profiles)
      .set({ username: null })
      .where(eq(profiles.id, id(11)));
    await expect(invite(t.slug, 11)).rejects.toMatchObject({
      name: 'Invalid',
      message: 'unavailable',
    });
    await test.db
      .update(profiles)
      .set({ status: 'suspended' })
      .where(eq(profiles.id, id(12)));
    await expect(invite(t.slug, 12)).rejects.toMatchObject({
      name: 'Invalid',
      message: 'unavailable',
    });
  });
  it('limits successful invitations to five per minute across tables', async () => {
    for (let p = 3; p <= 7; p++) {
      const t = await table();
      await invite(t.slug, p);
    }
    const t = await table();
    await expect(invite(t.slug, 8)).rejects.toMatchObject({ name: 'RateLimited' });
  });
});

const editInput = async (slug: string, over: Record<string, unknown> = {}) =>
  toTableInput(
    tableFormSchema.parse({
      ...(await loadTableForEdit(test.db, actor(1), slug, 'UTC')),
      ...over,
      removeImage: false,
    }),
  );
describe('invitation lifecycle and privacy', () => {
  it('invalidates old consent when an awaiting session is postponed', async () => {
    const t = await table();
    const i = await invite(t.slug);
    await test.db
      .update(gameTables)
      .set({ status: 'awaiting_confirmation' })
      .where(eq(gameTables.id, t.id));
    await postponeTable(test.db, actor(1), t.slug, '2030-01-05T00:00', now);
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).status).toBe('cancelled');
  });
  it('refuses capacity below reservations inside the table write', async () => {
    const t = await table({ capacity: 2 });
    await invite(t.slug);
    await invite(t.slug, 3);
    await expect(
      updateTable(test.db, actor(1), t.slug, await editInput(t.slug, { capacity: 1 })),
    ).rejects.toMatchObject({ name: 'Invalid', field: 'capacity' });
  });
  it('invalidates consent after a schedule edit but keeps invitations after a title edit', async () => {
    const t = await table();
    const i = await invite(t.slug);
    await updateTable(
      test.db,
      actor(1),
      t.slug,
      await editInput(t.slug, { title: 'Outro título' }),
    );
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).status).toBe('pending');
    await updateTable(
      test.db,
      actor(1),
      t.slug,
      await editInput(t.slug, { startsAtLocal: '2030-01-05T00:00' }),
    );
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).status).toBe('cancelled');
    expect(
      await respondToInvitation(test.db, actor(2), i.invitationId, 'accept', { now }),
    ).toMatchObject({ status: 'cancelled' });
  });
  it('cancels reservations when the GM disables a table', async () => {
    const t = await table();
    const i = await invite(t.slug);
    await disableTable(test.db, actor(1), t.slug);
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).status).toBe('cancelled');
  });
  it.each([1, 2])('cancels pending invitations when profile %s is suspended', async (n) => {
    const t = await table();
    const i = await invite(t.slug);
    const admin = { ...actor(10), role: 'admin' as const };
    await banAccount(test.db, admin, id(n), { until: null, reason: 'Moderação', now });
    expect(
      (
        await test.db
          .select()
          .from(playerInvitations)
          .where(eq(playerInvitations.id, i.invitationId))
      )[0].status,
    ).toBe('cancelled');
  });
  it('closes reservations when moderation closes a table', async () => {
    const t = await table();
    const i = await invite(t.slug);
    await closeTableByAdmin(test.db, { ...actor(10), role: 'admin' }, t.id, 'Moderação', { now });
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).status).toBe('cancelled');
  });
  it('exports private consent preferences and erases invitation identities at account deletion', async () => {
    const t = await table();
    const i = await invite(t.slug);
    await setGmInviteBlock(test.db, actor(2), id(4), true, { now });
    const data = await exportAccount(test.db, id(2), 'private@example.com', now);
    expect(data.profile).toMatchObject({ invitationsEnabled: true });
    expect(data.invitationsReceived).toEqual([
      expect.objectContaining({ id: i.invitationId, status: 'pending' }),
    ]);
    expect(data.invitationBlocks).toEqual([expect.objectContaining({ gmId: id(4) })]);
    await closeAccount(test.db, id(2));
    expect((await loadInvitation(test.db, actor(2), i.invitationId)).status).toBe('cancelled');
    await anonymiseProfile(test.db, id(2));
    expect(
      await test.db
        .select()
        .from(playerInvitations)
        .where(eq(playerInvitations.playerId, id(2))),
    ).toEqual([]);
    expect(
      await test.db
        .select()
        .from(gmInviteBlocks)
        .where(eq(gmInviteBlocks.playerId, id(2))),
    ).toEqual([]);
    await test.db
      .update(profiles)
      .set({ username: 'invite2', status: 'active', invitationsEnabled: true })
      .where(eq(profiles.id, id(2)));
  });
  it('materializes expiry only once in bounded sweeper batches', async () => {
    const t = await table();
    await invite(t.slug);
    const deadline = new Date('2030-01-03T00:00:00Z');
    expect(await expireInvitations(test.db, { now: deadline, limit: 1 })).toMatchObject({
      processed: 1,
    });
    expect(await expireInvitations(test.db, { now: deadline })).toEqual({
      processed: 0,
      eventIds: [],
    });
  });
  it('limits invitations across the full rolling day after minute limits reset', async () => {
    const t = await table();
    for (let n = 0; n < 20; n++) {
      const at = new Date(now.getTime() + n * 120000);
      const i = await invite(t.slug, 2, at);
      await cancelInvitation(test.db, actor(1), i.invitationId, { now: at });
    }
    await expect(invite(t.slug, 2, new Date(now.getTime() + 40 * 60000))).rejects.toMatchObject({
      name: 'RateLimited',
    });
  });
});

it('does not approve a pending request after the table is closed', async () => {
  const t = await table({ joinMode: 'approval' });
  await joinTable(test.db, actor(3), t.slug, { now });
  await disableTable(test.db, actor(1), t.slug);
  await expect(approveRegistration(test.db, actor(1), t.slug, actor(3).id)).rejects.toMatchObject({
    name: 'NotFound',
  });
});
