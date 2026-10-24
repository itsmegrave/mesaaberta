import { afterAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import {
  conversations,
  events,
  gameTables,
  profiles,
  systems,
  registrations,
} from '@mesaaberta/core/server/db/schema';
import { createTable, disableTable, publishTable } from '@mesaaberta/core/server/tables/write';
import { closeTable, deleteDraftTable } from '@mesaaberta/core/server/tables/end';
import { concludeTable, markTableNotHeld } from '@mesaaberta/core/server/tables/lifecycle';
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
