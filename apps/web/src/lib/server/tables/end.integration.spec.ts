import { afterAll, describe, expect, it } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  conversations,
  events,
  gameTables,
  profiles,
  systems,
  registrations,
  playerInvitations,
} from '@mesaaberta/core/server/db/schema';
import { createTable, disableTable, publishTable } from '@mesaaberta/core/server/tables/write';
import { closeTable, deleteDraftTable } from '@mesaaberta/core/server/tables/end';
import { concludeTable, markTableNotHeld } from '@mesaaberta/core/server/tables/lifecycle';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { lockTableRows } from '@mesaaberta/core/server/tables/schedule-guard';
import { invitePlayer, respondToInvitation } from '@mesaaberta/core/server/invitations/service';
import { joinTable } from '@mesaaberta/core/server/registrations/service';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import { openIntegrationDb } from '../db/integration-db';

const { db, close } = openIntegrationDb();
const owners: string[] = [];
const setup = async () => {
  const id = crypto.randomUUID();
  owners.push(id);
  await db.insert(profiles).values({ id, username: `dup${id.slice(0, 8)}` });
  const actor: Actor = { id, status: 'active', role: 'member' };
  const [system] = await db.select().from(systems).where(eq(systems.status, 'approved')).limit(1);
  const input: TableInput = {
    systemSlug: system.slug,
    title: `Duplicação ${id}`,
    description: '',
    extraInfo: null,
    welcomeMessage: null,
    kind: 'one_shot',
    capacity: 5,
    minPlayers: 3,
    startsAtLocal: '2099-01-01T18:00',
    timezone: 'UTC',
    durationMinutes: 120,
    recurrence: null,
    untilLocalDate: null,
    joinMode: 'auto',
    modality: 'online',
    locationArea: null,
    joinDetails: null,
    postalCode: null,
    locationNeighbourhood: null,
    locationCity: null,
    locationState: null,
    platforms: [],
    tags: [],
    removeImage: false,
  };
  const source = await createTable(db, actor, input, { draft: true });
  return { actor, input, source };
};
const row = async (slug: string) =>
  (await db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0];
afterAll(async () => {
  if (owners.length) {
    await db.delete(events).where(inArray(events.actorId, owners));
    const tables = await db
      .select({ id: gameTables.id })
      .from(gameTables)
      .where(inArray(gameTables.gmId, owners));
    const ids = tables.map((t) => t.id);
    if (ids.length) {
      await db.delete(registrations).where(inArray(registrations.tableId, ids));
      await db.delete(conversations).where(inArray(conversations.tableId, ids));
      await db.delete(gameTables).where(inArray(gameTables.id, ids));
    }
    await db.delete(profiles).where(inArray(profiles.id, owners));
  }
  await close();
});

describe('table end concurrency on PostgreSQL', () => {
  it('serializes deletion against publication without removing any published table', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { actor, source } = await setup();
      const outcomes = await Promise.allSettled([
        deleteDraftTable(db, actor, source.slug),
        publishTable(db, actor, source.slug),
      ]);
      expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const current = await row(source.slug);
      const audit = await db.select().from(events).where(eq(events.actorId, actor.id));
      if (current) {
        expect(current.status).toBe('active');
        expect(audit.filter((event) => event.type === 'TableCreated')).toHaveLength(1);
        expect(audit.filter((event) => event.type === 'TableDraftDeleted')).toHaveLength(0);
      } else {
        expect(audit.filter((event) => event.type === 'TableCreated')).toHaveLength(0);
        expect(audit.filter((event) => event.type === 'TableDraftDeleted')).toHaveLength(1);
      }
      const rejected = outcomes.find((result) => result.status === 'rejected');
      expect(rejected).toMatchObject({ reason: { name: current ? 'Invalid' : 'NotFound' } });
    }
  });
  it('keeps a stale legacy disable from restoring the erased draft audit', async () => {
    const { actor, source } = await setup();
    const outcomes = await Promise.allSettled([
      deleteDraftTable(db, actor, source.slug),
      disableTable(db, actor, source.slug),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const current = await row(source.slug);
    if (current) {
      expect(current.status).toBe('disabled');
    } else {
      const audit = await db.select().from(events).where(eq(events.actorId, actor.id));
      expect(audit.every((entry) => Object.keys(entry.payload as object).length === 1)).toBe(true);
      expect(audit.filter((entry) => entry.type === 'TableDisabled')).toHaveLength(0);
    }
  });
  it.each([
    ['concluded', concludeTable],
    ['not_held', markTableNotHeld],
  ] as const)(
    'preserves the %s result when confirmation races closure',
    async (status, confirm) => {
      const { actor, source } = await setup();
      await db
        .update(gameTables)
        .set({ status: 'awaiting_confirmation' })
        .where(eq(gameTables.slug, source.slug));
      const outcomes = await Promise.allSettled([
        confirm(db, actor, source.slug),
        closeTable(db, actor, source.slug),
      ]);
      expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const current = await row(source.slug);
      expect([status, 'disabled']).toContain(current.status);
      const audit = await db.select().from(events).where(eq(events.actorId, actor.id));
      expect(
        audit.filter((entry) =>
          ['TableConcluded', 'TableNotHeld', 'TableDisabled'].includes(entry.type),
        ),
      ).toHaveLength(1);
    },
  );
  it('cancels a reservation under the same lock as an invitation acceptance', async () => {
    const { actor, source } = await setup();
    const { actor: player } = await setup();
    await publishTable(db, actor, source.slug);
    const invitation = await invitePlayer(db, actor, source.slug, player.id);
    const outcomes = await Promise.allSettled([
      respondToInvitation(db, player, invitation.invitationId, 'accept'),
      closeTable(db, actor, source.slug),
    ]);
    expect(outcomes[1].status).toBe('fulfilled');
    expect(await row(source.slug)).toMatchObject({ status: 'disabled' });
    const [saved] = await db
      .select()
      .from(playerInvitations)
      .where(eq(playerInvitations.id, invitation.invitationId));
    const seated = await db
      .select()
      .from(registrations)
      .where(eq(registrations.tableId, saved.tableId));
    expect(outcomes[0].status).toBe('fulfilled');
    if (outcomes[0].status !== 'fulfilled') throw outcomes[0].reason;
    expect(saved.status).toBe(outcomes[0].value.status);
    expect(seated).toHaveLength(outcomes[0].value.status === 'accepted' ? 1 : 0);
    const audit = await db.select().from(events).where(eq(events.actorId, actor.id));
    expect(audit.filter((entry) => entry.type === 'TableDisabled')).toHaveLength(1);
  });
  it('locks copied tables before the source deletion FK update in the same order as bulk writers', async () => {
    const { actor, source } = await setup();
    const original = await row(source.slug);
    const suffix = crypto.randomUUID().slice(8);
    const sourceId = `ffffffff${suffix}`;
    const childId = `00000000${suffix}`;
    const sourceSlug = `family-source-${sourceId}`;
    await db.insert(gameTables).values([
      { ...original, id: sourceId, slug: sourceSlug },
      {
        ...original,
        id: childId,
        slug: `family-copy-${childId}`,
        duplicatedFromTableId: sourceId,
        startsAt: new Date(original.startsAt.getTime() + 86400000),
      },
    ]);
    let deletion: Promise<{ error: unknown }> | undefined;
    await db.transaction(async (tx) => {
      const transaction = tx as unknown as AnyDb;
      await tx.execute(sql`set local deadlock_timeout = '100ms'`);
      // Pause a bulk writer after its lowest UUID, before it reaches the source. The deletion
      // must wait here too, rather than lock the source and then wait on the child's FK update.
      await lockTableRows(transaction, [childId]);
      deletion = deleteDraftTable(db, actor, sourceSlug).then(
        () => ({ error: null }),
        (error) => ({ error }),
      );
      const deadline = Date.now() + 5000;
      while (true) {
        const [blocked] = await db.execute(
          sql`select count(*)::int as waiting from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
        );
        if (Number(blocked.waiting) > 0) break;
        if (Date.now() > deadline) throw new Error('deletion never waited for the bulk table lock');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await lockTableRows(transaction, [sourceId]);
    });
    expect(await deletion).toEqual({ error: null });
    expect(await row(sourceSlug)).toBeUndefined();
    const [child] = await db.select().from(gameTables).where(eq(gameTables.id, childId));
    expect(child.duplicatedFromTableId).toBeNull();
  });
  it('closes concurrently once and prevents any new joins afterward', async () => {
    const { actor, source } = await setup();
    const { actor: player } = await setup();
    await publishTable(db, actor, source.slug);
    const results = await Promise.all([
      closeTable(db, actor, source.slug),
      closeTable(db, actor, source.slug),
    ]);
    expect(results.flatMap((result) => result.eventIds)).toHaveLength(1);
    expect(await row(source.slug)).toMatchObject({ status: 'disabled', icalSequence: 1 });
    await expect(joinTable(db, player, source.slug)).rejects.toMatchObject({ name: 'NotFound' });
    const audit = await db.select().from(events).where(eq(events.actorId, actor.id));
    expect(audit.filter((event) => event.type === 'TableDisabled')).toHaveLength(1);
  });
});
