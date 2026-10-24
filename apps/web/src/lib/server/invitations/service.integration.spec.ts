import { afterAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  conversations,
  events,
  gameTables,
  playerInvitations,
  profiles,
  registrations,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { openIntegrationDb } from '../db/integration-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  invitePlayer,
  lockInvitationProfiles,
  respondToInvitation,
  cancelInvitation,
  setInvitationsEnabled,
  setGmInviteBlock,
} from '@mesaaberta/core/server/invitations/service';
import { seatAvailability } from '@mesaaberta/core/server/invitations/seats';
import { joinTable, approveRegistration } from '@mesaaberta/core/server/registrations/service';
import { updateTable, loadTableForEdit } from '@mesaaberta/core/server/tables/write';
import { tableFormSchema, toTableInput } from '@mesaaberta/core/tables/schema';
const { db, close } = openIntegrationDb();
const ids: string[] = [];
const tableIds: string[] = [];
const now = new Date('2035-01-01T00:00:00Z');
async function person(): Promise<Actor> {
  const id = crypto.randomUUID();
  ids.push(id);
  await db.insert(profiles).values({ id, username: `inv-${id.slice(0, 8)}` });
  return { id, role: 'member', status: 'active' };
}
async function fixture(over: Partial<typeof gameTables.$inferInsert> = {}) {
  const gm = await person(),
    a = await person(),
    b = await person();
  const [system] = await db.select().from(systems).limit(1);
  const [table] = await db
    .insert(gameTables)
    .values({
      gmId: gm.id,
      slug: `inv-${crypto.randomUUID()}`,
      title: 'Invitation concurrency',
      kind: 'one_shot',
      capacity: 1,
      startsAt: new Date('2035-01-04T00:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      systemId: system.id,
      ...over,
    })
    .returning();
  tableIds.push(table.id);
  return { gm, a, b, table };
}
afterAll(async () => {
  if (tableIds.length) {
    await db.delete(registrations).where(inArray(registrations.tableId, tableIds));
    await db.delete(events).where(inArray(sql`${events.payload}->>'tableId'`, tableIds));
    await db.delete(conversations).where(inArray(conversations.tableId, tableIds));
    await db.delete(gameTables).where(inArray(gameTables.id, tableIds));
  }
  if (ids.length) await db.delete(profiles).where(inArray(profiles.id, ids));
  await close();
});

describe('invitation concurrency on real PostgreSQL', () => {
  it('gives the last seat to exactly one invitation or voluntary join', async () => {
    const { gm, a, b, table } = await fixture();
    const outcomes = await Promise.allSettled([
      invitePlayer(db, gm, table.slug, a.id, { now }),
      joinTable(db, b, table.slug, { now }),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await seatAvailability(db, table.id, now)).toMatchObject({ available: 0 });
    const seats = await seatAvailability(db, table.id, now);
    expect(seats.confirmed + seats.reserved).toBe(1);
  });
  it('serializes approval against an invitation to the last seat', async () => {
    const { gm, a, b, table } = await fixture({ joinMode: 'approval' });
    await joinTable(db, b, table.slug, { now });
    const outcomes = await Promise.allSettled([
      invitePlayer(db, gm, table.slug, a.id, { now }),
      approveRegistration(db, gm, table.slug, b.id),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const seats = await seatAvailability(db, table.id, now);
    expect(seats.confirmed + seats.reserved).toBe(1);
  });
  it.each(['decline', 'cancel', 'expire'] as const)(
    'commits one response/event set for acceptance racing %s',
    async (other) => {
      const { gm, a, table } = await fixture();
      const { invitationId } = await invitePlayer(db, gm, table.slug, a.id, { now });
      await Promise.all([
        respondToInvitation(db, a, invitationId, 'accept', { now }),
        other === 'cancel'
          ? cancelInvitation(db, gm, invitationId, { now })
          : respondToInvitation(db, a, invitationId, other === 'decline' ? 'decline' : 'accept', {
              now: other === 'expire' ? new Date('2035-01-03T00:00:00Z') : now,
            }),
      ]);
      const [i] = await db
        .select()
        .from(playerInvitations)
        .where(eq(playerInvitations.id, invitationId));
      const transitions = await db
        .select()
        .from(events)
        .where(
          and(
            eq(sql`${events.payload}->>'invitationId'`, invitationId),
            inArray(events.type, [
              'InvitationAccepted',
              'InvitationDeclined',
              'InvitationCancelled',
              'InvitationExpired',
            ]),
          ),
        );
      expect(transitions).toHaveLength(1);
      expect((await seatAvailability(db, table.id, now)).confirmed).toBe(
        i.status === 'accepted' ? 1 : 0,
      );
    },
  );
  it.each(['opt_out', 'block'] as const)(
    'serializes %s against invitation issuance',
    async (mode) => {
      const { gm, a, table } = await fixture();
      await Promise.allSettled([
        invitePlayer(db, gm, table.slug, a.id, { now }),
        mode === 'opt_out'
          ? setInvitationsEnabled(db, a, false, { now })
          : setGmInviteBlock(db, a, gm.id, true, { now }),
      ]);
      expect(await seatAvailability(db, table.id, now)).toEqual({
        confirmed: 0,
        reserved: 0,
        available: 1,
      });
      expect(
        await db
          .select()
          .from(playerInvitations)
          .where(
            and(eq(playerInvitations.tableId, table.id), eq(playerInvitations.status, 'pending')),
          ),
      ).toHaveLength(0);
    },
  );
  it.each(['opt_out', 'block'] as const)(
    'preserves already confirmed seats when acceptance races %s',
    async (mode) => {
      const { gm, a, table } = await fixture();
      const { invitationId } = await invitePlayer(db, gm, table.slug, a.id, { now });
      await Promise.all([
        respondToInvitation(db, a, invitationId, 'accept', { now }),
        mode === 'opt_out'
          ? setInvitationsEnabled(db, a, false, { now })
          : setGmInviteBlock(db, a, gm.id, true, { now }),
      ]);
      const [i] = await db
        .select()
        .from(playerInvitations)
        .where(eq(playerInvitations.id, invitationId));
      expect(['accepted', 'cancelled']).toContain(i.status);
      const seats = await seatAvailability(db, table.id, now);
      expect(seats.reserved).toBe(0);
      expect(seats.confirmed).toBe(i.status === 'accepted' ? 1 : 0);
    },
  );
  it('never reduces capacity below a racing reservation', async () => {
    const { gm, a, table } = await fixture({ capacity: 2 });
    await joinTable(db, await person(), table.slug, { now });
    const form = await loadTableForEdit(db, gm, table.slug, 'UTC');
    const input = toTableInput(tableFormSchema.parse({ ...form, capacity: 1, removeImage: false }));
    await Promise.allSettled([
      invitePlayer(db, gm, table.slug, a.id, { now }),
      updateTable(db, gm, table.slug, input),
    ]);
    const [saved] = await db.select().from(gameTables).where(eq(gameTables.id, table.id));
    const seats = await seatAvailability(db, table.id, now);
    expect(seats.confirmed + seats.reserved).toBeLessThanOrEqual(saved.capacity);
  });
});

it('keeps profile eligibility locks compatible with a simultaneous join foreign-key check', async () => {
  const { gm, a, table } = await fixture();
  let tableLocked!: () => void;
  let profilesLocked!: () => void;
  const tableReady = new Promise<void>((resolve) => {
    tableLocked = resolve;
  });
  const profilesReady = new Promise<void>((resolve) => {
    profilesLocked = resolve;
  });
  const joining = db.transaction(async (tx) => {
    await tx
      .select({ id: gameTables.id })
      .from(gameTables)
      .where(eq(gameTables.id, table.id))
      .for('update');
    tableLocked();
    await profilesReady;
    return joinTable(tx as unknown as Parameters<typeof joinTable>[0], a, table.slug, { now });
  });
  const inviting = db.transaction(async (tx) => {
    await tableReady;
    await lockInvitationProfiles(tx as unknown as Parameters<typeof invitePlayer>[0], [
      gm.id,
      a.id,
    ]);
    profilesLocked();
    return invitePlayer(tx as unknown as Parameters<typeof invitePlayer>[0], gm, table.slug, a.id, {
      now,
    });
  });
  const outcomes = await Promise.allSettled([joining, inviting]);
  expect(outcomes[0].status).toBe('fulfilled');
  expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { name: 'Invalid' } });
  expect(await seatAvailability(db, table.id, now)).toEqual({
    confirmed: 1,
    reserved: 0,
    available: 0,
  });
});
