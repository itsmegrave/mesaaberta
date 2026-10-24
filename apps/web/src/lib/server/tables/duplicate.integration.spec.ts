import { afterAll, describe, expect, it } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  conversations,
  events,
  gameTables,
  profiles,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { duplicateTable } from '@mesaaberta/core/server/tables/duplicate';
import { createTable, publishTable, updateTable } from '@mesaaberta/core/server/tables/write';
import { intervalsOverlap } from '@mesaaberta/core/server/tables/schedule';
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
  const source = await createTable(db, actor, input);
  return { actor, input, source };
};
const row = async (slug: string) =>
  (await db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0];
afterAll(async () => {
  if (owners.length) {
    const tables = await db
      .select({ id: gameTables.id })
      .from(gameTables)
      .where(inArray(gameTables.gmId, owners));
    const ids = tables.map((t) => t.id);
    if (ids.length) {
      await db.delete(events).where(inArray(sql`${events.payload}->>'tableId'`, ids));
      await db.delete(conversations).where(inArray(conversations.tableId, ids));
      await db.delete(gameTables).where(inArray(gameTables.id, ids));
    }
    await db.delete(profiles).where(inArray(profiles.id, owners));
  }
  await close();
});

describe('duplicate schedule concurrency', () => {
  it('accepts exactly one incompatible source edit or new copy, with no partial table or event', async () => {
    const { actor, input, source } = await setup();
    const results = await Promise.allSettled([
      updateTable(db, actor, source.slug, { ...input, durationMinutes: 180 }),
      duplicateTable(db, actor, source.slug, { ...input, startsAtLocal: '2099-01-01T20:00' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toMatchObject([
      { reason: { field: 'startsAtLocal', message: 'schedule_conflict' } },
    ]);
    const tables = await db.select().from(gameTables).where(eq(gameTables.gmId, actor.id));
    if (tables.length === 2) expect(intervalsOverlap(tables[0], tables[1])).toBe(false);
    const created = await db.select().from(events).where(eq(events.actorId, actor.id));
    expect(created.filter((e) => e.type === 'TableCreated')).toHaveLength(tables.length);
  });
  it('serializes a draft publication against a source edit that would overlap', async () => {
    const { actor, input, source } = await setup();
    const copy = await duplicateTable(
      db,
      actor,
      source.slug,
      { ...input, startsAtLocal: '2099-01-01T20:00' },
      { draft: true },
    );
    const results = await Promise.allSettled([
      publishTable(db, actor, copy.slug),
      updateTable(db, actor, source.slug, { ...input, durationMinutes: 180 }),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { message: 'schedule_conflict' },
    });
    expect(intervalsOverlap(await row(source.slug), await row(copy.slug))).toBe(false);
  });
  it('serializes replayed submissions and distinct concurrent slugs', async () => {
    const { actor, input, source } = await setup();
    const options = { requestKey: crypto.randomUUID() };
    const copies = await Promise.all([
      duplicateTable(
        db,
        actor,
        source.slug,
        { ...input, startsAtLocal: '2099-01-02T18:00' },
        options,
      ),
      duplicateTable(
        db,
        actor,
        source.slug,
        { ...input, startsAtLocal: '2099-01-02T18:00' },
        options,
      ),
    ]);
    expect(copies[0]).toEqual(copies[1]);
    const distinct = await Promise.all([
      duplicateTable(db, actor, source.slug, { ...input, startsAtLocal: '2099-01-03T18:00' }),
      duplicateTable(db, actor, source.slug, { ...input, startsAtLocal: '2099-01-04T18:00' }),
    ]);
    expect(new Set(distinct.map((c) => c.slug)).size).toBe(2);
    // Copies of one source also hold their slots against each other, even when made at once.
    const clash = await Promise.allSettled([
      duplicateTable(db, actor, source.slug, { ...input, startsAtLocal: '2099-01-05T18:00' }),
      duplicateTable(db, actor, source.slug, { ...input, startsAtLocal: '2099-01-05T18:00' }),
    ]);
    expect(clash.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });
  it('rechecks moderation after waiting for a locked source', async () => {
    const { actor, input, source } = await setup();
    const original = await row(source.slug);
    let release!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const moderation = db.transaction(async (tx) => {
      await tx
        .update(gameTables)
        .set({ moderatedAt: new Date(), status: 'disabled' })
        .where(eq(gameTables.id, original.id));
      locked();
      await hold;
    });
    await acquired;
    const copied = duplicateTable(db, actor, source.slug, {
      ...input,
      startsAtLocal: '2099-01-02T18:00',
    });
    try {
      // Confirm the duplicate really reached its row lock before committing the moderation.
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await db.execute(
          sql`select pid from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%game_tables%'`,
        );
        if (rows.length) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
    }
    await moderation;
    await expect(copied).rejects.toMatchObject({ name: 'Forbidden' });
    expect(await db.select().from(gameTables).where(eq(gameTables.gmId, actor.id))).toHaveLength(1);
  });
});

it('does not deadlock family edits against bulk account closure after a shared blocker releases', async () => {
  const { closeAccount } = await import('@mesaaberta/core/server/account/service');
  const { actor, input, source } = await setup();
  const copy = await duplicateTable(db, actor, source.slug, {
    ...input,
    startsAtLocal: '2099-01-02T18:00',
  });
  const sourceRow = await row(source.slug);
  const suffix = actor.id.slice(0, 8);
  const closingName = `dup-close-${suffix}`;
  const editingName = `dup-edit-${suffix}`;
  let release!: () => void;
  let acquired!: () => void;
  const locked = new Promise<void>((resolve) => {
    acquired = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(gameTables).where(eq(gameTables.id, sourceRow.id)).for('update');
    acquired();
    await hold;
  });
  await locked;
  const waitForLock = async (applicationName: string) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const waiting = await db.execute(
        sql`select pid from pg_stat_activity where application_name = ${applicationName} and wait_event_type = 'Lock'`,
      );
      if (waiting.length) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Transaction did not reach its lock: ${applicationName}`);
  };
  const closing = db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('application_name', ${closingName}, true)`);
    return closeAccount(
      tx as unknown as import('@mesaaberta/core/server/db/client').AnyDb,
      actor.id,
    );
  });
  let editing: Promise<unknown> | undefined;
  try {
    // Queue closure first. The old edit then locked the copy before waiting for its source,
    // making closure wait for the copy while the edit waited for closure's source lock.
    await waitForLock(closingName);
    editing = db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('application_name', ${editingName}, true)`);
      return updateTable(
        tx as unknown as import('@mesaaberta/core/server/db/client').AnyDb,
        actor,
        copy.slug,
        { ...input, title: 'Edited after closure', startsAtLocal: '2099-01-02T18:00' },
      );
    });
    await waitForLock(editingName);
  } finally {
    release();
  }
  await blocker;
  await expect(Promise.all([closing, editing])).resolves.toHaveLength(2);
  expect((await row(source.slug)).status).toBe('disabled');
  expect((await row(copy.slug)).status).toBe('disabled');
});
