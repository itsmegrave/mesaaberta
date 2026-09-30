import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import {
  events,
  gameTablePlatforms,
  gameTableTags,
  gameTables,
  platforms,
  profiles,
  systems,
  tags,
} from '../db/schema';
import { Forbidden, Invalid } from '../errors';
import {
  approveEntry,
  createEntry,
  disableEntry,
  listCatalogAdmin,
  listQueue,
  mergeEntry,
  nearDuplicate,
  pendingCount,
  recentDecisions,
  rejectEntry,
  renameEntry,
} from './catalog';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin = { id: id(1), role: 'admin' as const, status: 'active' as const };
const gm = { id: id(2), role: 'member' as const, status: 'active' as const };
const tableId = (n: number) => id(100 + n);
// The catalog ships seeded; this is one of its platforms.
let foundryId = '';

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin.id, username: 'ana', role: 'admin' },
    { id: gm.id, username: 'bruno' },
  ]);
  const [foundry] = await test.db.select().from(platforms).where(eq(platforms.slug, 'foundry-vtt'));
  foundryId = foundry.id;
  const [system] = await test.db.select().from(systems).limit(1);
  for (let n = 1; n <= 3; n++) {
    await test.db.insert(gameTables).values({
      id: tableId(n),
      slug: `mesa-${n}`,
      title: `Mesa ${n}`,
      gmId: gm.id,
      systemId: system.id,
      kind: 'one_shot',
      capacity: 5,
      durationMinutes: 120,
      timezone: 'UTC',
      startsAt: new Date('2099-01-01T20:00:00Z'),
      modality: 'online',
    });
  }
});
afterAll(() => test.close());

const platform = async (
  name: string,
  slug: string,
  status: 'pending' | 'approved' = 'pending',
  n = 0,
) => {
  const [row] = await test.db
    .insert(platforms)
    .values({ id: id(200 + n), name, slug, status, suggestedBy: gm.id })
    .returning();
  return row;
};

describe('the approval queue', () => {
  it('lists pending suggestions with who suggested them, their tables and a near-duplicate', async () => {
    await platform('Foundry', 'foundry', 'pending', 1);
    await test.db.insert(gameTablePlatforms).values([
      { tableId: tableId(1), platformId: id(201), position: 0 },
      { tableId: tableId(2), platformId: id(201), position: 0 },
    ]);
    await test.db.insert(tags).values({
      id: id(300),
      name: 'Megadungeon',
      slug: 'megadungeon',
      status: 'pending',
      suggestedBy: gm.id,
    });

    const queue = await listQueue(test.db);

    expect(queue.map((e) => [e.kind, e.name, e.suggestedBy])).toEqual([
      ['platform', 'Foundry', 'bruno'],
      ['tag', 'Megadungeon', 'bruno'],
    ]);
    expect(queue[0].tables.map((t) => t.title)).toEqual(['Mesa 1', 'Mesa 2']);
    expect(queue[0].duplicateOf).toEqual({ id: foundryId, name: 'Foundry VTT' });
    expect(queue[1].duplicateOf).toBeNull();
    expect(await pendingCount(test.db)).toBe(2);
  });

  it('approves a suggestion and records who decided', async () => {
    const eventId = await approveEntry(test.db, admin, 'tag', id(300));

    const [row] = await test.db
      .select()
      .from(tags)
      .where(eq(tags.id, id(300)));
    expect(row.status).toBe('approved');
    expect(row.reviewedBy).toBe(admin.id);
    const [event] = await test.db.select().from(events).where(eq(events.id, eventId));
    expect(event).toMatchObject({ type: 'CatalogEntryApproved', actorId: admin.id });
    expect(event.payload).toEqual({ kind: 'tag', entryId: id(300), name: 'Megadungeon' });
    await expect(approveEntry(test.db, admin, 'tag', id(300))).rejects.toMatchObject({
      message: 'not_pending',
    });
  });

  it('shows the decisions, newest first, from the events', async () => {
    const decisions = await recentDecisions(test.db);
    expect(decisions[0]).toMatchObject({
      type: 'CatalogEntryApproved',
      kind: 'tag',
      name: 'Megadungeon',
      by: 'ana',
    });
  });

  it('rejects a suggestion: the tables lose it', async () => {
    await rejectEntry(test.db, admin, 'platform', id(201));

    expect(await test.db.select().from(gameTablePlatforms)).toEqual([]);
    const [row] = await test.db
      .select()
      .from(platforms)
      .where(eq(platforms.id, id(201)));
    expect(row.status).toBe('rejected');
  });
});

describe('moderation', () => {
  it('renames an entry and its slug follows, unless the slug is taken', async () => {
    await platform('Roll20', 'roll-20', 'approved', 2);
    await renameEntry(test.db, admin, 'platform', id(202), 'Roll 20 ');
    const [row] = await test.db
      .select()
      .from(platforms)
      .where(eq(platforms.id, id(202)));
    expect([row.name, row.slug]).toEqual(['Roll 20', 'roll-20']);

    await expect(
      renameEntry(test.db, admin, 'platform', id(202), 'Foundry VTT'),
    ).rejects.toMatchObject({
      field: 'name',
      message: 'taken',
    });
    await expect(renameEntry(test.db, admin, 'platform', id(202), ' ')).rejects.toBeInstanceOf(
      Invalid,
    );
  });

  it('merges into another entry: tables move once, and the source stays as a record', async () => {
    await platform('Foundry Virtual', 'foundry-virtual', 'approved', 3);
    await test.db.insert(gameTablePlatforms).values([
      { tableId: tableId(1), platformId: id(203), position: 0 },
      { tableId: tableId(2), platformId: id(203), position: 0 },
      { tableId: tableId(2), platformId: foundryId, position: 1 },
    ]);

    await mergeEntry(test.db, admin, 'platform', id(203), foundryId);

    const links = await test.db.select().from(gameTablePlatforms);
    expect(links.map((l) => [l.tableId, l.platformId]).sort()).toEqual(
      [
        [tableId(1), foundryId],
        [tableId(2), foundryId],
      ].sort(),
    );
    const [source] = await test.db
      .select()
      .from(platforms)
      .where(eq(platforms.id, id(203)));
    expect([source.status, source.mergedInto]).toEqual(['rejected', foundryId]);
    await expect(
      mergeEntry(test.db, admin, 'platform', foundryId, foundryId),
    ).rejects.toMatchObject({
      message: 'same',
    });
    await expect(mergeEntry(test.db, admin, 'platform', foundryId, id(203))).rejects.toMatchObject({
      message: 'not_approved',
    });
  });

  it('disables an entry: it leaves the pickers, the tables keep it', async () => {
    await test.db
      .insert(gameTableTags)
      .values({ tableId: tableId(3), tagId: id(300), position: 0 });
    await disableEntry(test.db, admin, 'tag', id(300));

    const [row] = await test.db
      .select()
      .from(tags)
      .where(eq(tags.id, id(300)));
    expect(row.status).toBe('disabled');
    expect(await test.db.select().from(gameTableTags)).toHaveLength(1);
  });

  it('adds an approved entry, once per slug', async () => {
    await createEntry(test.db, admin, 'tag', 'Hexcrawl');
    const [row] = await test.db.select().from(tags).where(eq(tags.slug, 'hexcrawl'));
    expect(row.status).toBe('approved');
    await expect(createEntry(test.db, admin, 'tag', 'hexcrawl')).rejects.toMatchObject({
      message: 'taken',
    });
  });

  it('is for admins only', async () => {
    await expect(approveEntry(test.db, gm, 'tag', id(300))).rejects.toBeInstanceOf(Forbidden);
    await expect(createEntry(test.db, null, 'tag', 'Qualquer')).rejects.toBeDefined();
  });
});

describe('the catalog list', () => {
  it('counts the tables that use each entry, searches by name and pages', async () => {
    const { rows, total } = await listCatalogAdmin(test.db, 'platform');
    expect(total).toBe(rows.length);
    expect(rows.find((r) => r.name === 'Foundry VTT')?.uses).toBe(2);
    expect(rows.some((r) => r.status === 'rejected')).toBe(false);

    const found = await listCatalogAdmin(test.db, 'platform', { query: 'roll' });
    expect(found.rows.map((r) => r.name)).toContain('Roll 20');
    expect((await listCatalogAdmin(test.db, 'platform', { query: '%' })).total).toBe(0);
    const past = await listCatalogAdmin(test.db, 'platform', { page: 99 });
    expect([past.rows, past.pages]).toEqual([[], 1]);
  });
});

describe('near duplicates', () => {
  const approved = [{ name: 'Foundry VTT' }, { name: 'Roll20' }, { name: 'Discord' }];
  it.each([
    ['foundry', 'Foundry VTT'],
    ['Roll 20', 'Roll20'],
    ['roll21', 'Roll20'],
    ['Discórd', 'Discord'],
  ])('%s repeats %s', (name, other) => {
    expect(nearDuplicate(name, approved)?.name).toBe(other);
  });
  it('leaves different names alone', () => {
    expect(nearDuplicate('Telegram', approved)).toBeNull();
    expect(nearDuplicate('VTT', approved)).toBeNull();
  });
});
