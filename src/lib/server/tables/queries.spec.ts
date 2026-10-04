import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { findTableBySlug, listUpcomingTables, seatsLeft } from './queries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const gm = '00000000-0000-4000-8000-000000000601';

const systemId = async (slug: string) =>
  (await test.db.select({ id: systems.id }).from(systems).where(eq(systems.slug, slug)))[0].id;

const add = async (
  over: Partial<typeof gameTables.$inferInsert> & { slug: string; systemSlug?: string },
) => {
  const { systemSlug = 'daggerheart', ...rest } = over;
  await test.db.insert(gameTables).values({
    title: over.slug,
    kind: 'one_shot',
    capacity: 5,
    startsAt: new Date('2026-10-10T22:00:00Z'),
    durationMinutes: 240,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
    systemId: await systemId(systemSlug),
    ...rest,
  });
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: gm, username: 'mestre-ana' });

  await add({ slug: 'later', title: 'Later', startsAt: new Date('2026-10-20T22:00:00Z') });
  await add({ slug: 'sooner', title: 'Sooner', startsAt: new Date('2026-10-05T22:00:00Z') });
  await add({ slug: 'over', title: 'Over', startsAt: new Date('2026-09-01T22:00:00Z') });
  await add({ slug: 'off', title: 'Off', status: 'disabled' });
  await add({
    slug: 'weekly',
    title: 'Weekly',
    kind: 'campaign',
    recurrence: 'FREQ=WEEKLY',
    startsAt: new Date('2026-10-03T21:00:00Z'),
    systemSlug: 'tormenta-20-t20',
  });
  // A campaign whose first date has passed: the platform keeps one date per table, so it is over.
  await add({
    slug: 'started-campaign',
    title: 'Started campaign',
    kind: 'campaign',
    recurrence: 'FREQ=WEEKLY',
    startsAt: new Date('2026-09-05T21:00:00Z'),
  });
  await add({ slug: 'starting-now', title: 'Starting now', startsAt: now });
});
afterAll(() => test.close());

describe('listUpcomingTables', () => {
  it('lists active tables that have not started, soonest first', async () => {
    const list = await listUpcomingTables(test.db, now);

    // weekly starts on 3 Oct, before sooner's 5 Oct
    expect(list.map((t) => t.slug)).toEqual(['weekly', 'sooner', 'later']);
  });

  it('never lists a disabled table', async () => {
    const list = await listUpcomingTables(test.db, now);

    expect(list.map((t) => t.slug)).not.toContain('off');
  });

  it('leaves out a table the moment its session starts, whatever its kind', async () => {
    const slugs = (await listUpcomingTables(test.db, now)).map((t) => t.slug);

    expect(slugs).not.toContain('over');
    expect(slugs).not.toContain('started-campaign');
    expect(slugs).not.toContain('starting-now');
  });

  it('gives each table what a card needs: system, GM, kind, seats and its date', async () => {
    const weekly = (await listUpcomingTables(test.db, now)).find((t) => t.slug === 'weekly');

    expect(weekly).toMatchObject({
      title: 'Weekly',
      kind: 'campaign',
      system: { name: 'Tormenta 20 (T20)', slug: 'tormenta-20-t20' },
      gmName: 'mestre-ana',
      capacity: 5,
      seatsLeft: 5,
      everyWeeks: 1,
      timezone: 'America/Sao_Paulo',
    });
    expect(weekly?.startsAt).toEqual(new Date('2026-10-03T21:00:00Z'));
  });

  it('can be narrowed to one system', async () => {
    const list = await listUpcomingTables(test.db, now, { systemSlug: 'tormenta-20-t20' });

    expect(list.map((t) => t.slug)).toEqual(['weekly']);
  });

  it('is empty for a system nobody plays, or one that does not exist', async () => {
    expect(await listUpcomingTables(test.db, now, { systemSlug: 'gurps' })).toEqual([]);
    expect(await listUpcomingTables(test.db, now, { systemSlug: 'nao-existe' })).toEqual([]);
  });
});

describe('findTableBySlug', () => {
  it('returns the table with everything its page shows', async () => {
    await add({ slug: 'full', description: 'Uma noite só.', extraInfo: 'Traga dados.' });

    expect(await findTableBySlug(test.db, 'full', now)).toMatchObject({
      slug: 'full',
      description: 'Uma noite só.',
      extraInfo: 'Traga dados.',
      gmName: 'mestre-ana',
      system: { slug: 'daggerheart' },
      durationMinutes: 240,
      startsAt: new Date('2026-10-10T22:00:00Z'),
    });
  });

  it('is null for a slug that does not exist', async () => {
    expect(await findTableBySlug(test.db, 'nao-existe', now)).toBeNull();
  });

  it('is null for a disabled table, as if it were not there', async () => {
    expect(await findTableBySlug(test.db, 'off', now)).toBeNull();
  });

  it('still opens a table whose session has started, with its date and status', async () => {
    expect(await findTableBySlug(test.db, 'over', now)).toMatchObject({
      startsAt: new Date('2026-09-01T22:00:00Z'),
      status: 'active',
    });
  });
});

describe('seats left', () => {
  const player = async (n: number) => {
    const playerId = `00000000-0000-4000-8000-0000000006${String(n).padStart(2, '0')}`;
    await test.db
      .insert(profiles)
      .values({ id: playerId, username: `j${n}` })
      .onConflictDoNothing();
    return playerId;
  };

  it('counts only confirmed registrations: a pending request takes no seat', async () => {
    await add({ slug: 'seats', capacity: 4 });
    const [table] = await test.db.select().from(gameTables).where(eq(gameTables.slug, 'seats'));
    await test.db.insert(registrations).values([
      { tableId: table.id, playerId: await player(1), status: 'confirmed' },
      { tableId: table.id, playerId: await player(2), status: 'confirmed' },
      { tableId: table.id, playerId: await player(3), status: 'pending' },
    ]);

    expect((await findTableBySlug(test.db, 'seats', now))?.seatsLeft).toBe(2);
    expect(
      (await listUpcomingTables(test.db, now)).find((t) => t.slug === 'seats')?.seatsLeft,
    ).toBe(2);
  });
});

describe('seatsLeft', () => {
  it('is the capacity minus the seats taken', () => {
    expect(seatsLeft(5, 2)).toBe(3);
  });

  it('is the whole capacity while nobody has joined', () => {
    expect(seatsLeft(5)).toBe(5);
  });

  it('never goes below zero', () => {
    expect(seatsLeft(5, 7)).toBe(0);
  });
});

describe('the GM welcome message', () => {
  it('is not part of what the public queries return', async () => {
    await add({ slug: 'greeted', welcomeMessage: 'Segredo do mestre' });
    try {
      const listed = await listUpcomingTables(test.db, now);
      const found = await findTableBySlug(test.db, 'greeted', now);

      expect(listed.map((table) => table.slug)).toContain('greeted');
      expect(found).not.toBeNull();
      expect(JSON.stringify(listed)).not.toContain('Segredo do mestre');
      expect(JSON.stringify(found)).not.toContain('Segredo do mestre');
    } finally {
      await test.db.delete(gameTables).where(eq(gameTables.slug, 'greeted'));
    }
  });
});
