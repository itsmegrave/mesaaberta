import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { createTable, loadTableForEdit } from '@mesaaberta/core/server/tables/write';
import { findTableBySlug } from '@mesaaberta/core/server/tables/queries';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const gm: Actor = { id: '00000000-0000-4000-8000-000000000301', role: 'member', status: 'active' };
const westmarch: TableInput = {
  systemSlug: 'daggerheart',
  title: 'Marcha do Oeste',
  description: '<p>Um mundo, muitas expedições</p>',
  extraInfo: null,
  welcomeMessage: null,
  kind: 'open',
  capacity: 40,
  sessionSize: 5,
  minPlayers: 3,
  plannedSessions: null,
  startsAtLocal: '2026-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: 240,
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
  placeId: null,
  platforms: [],
  tags: [],
  removeImage: false,
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: gm.id, username: 'westmarch-gm' });
});
afterAll(() => test.close());

describe('a westmarch table', () => {
  it('keeps a roster past the largest table, the players per session and no rhythm', async () => {
    const { slug } = await createTable(test.db, gm, westmarch, { now });
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.slug, slug));
    expect(row).toMatchObject({ kind: 'open', capacity: 40, sessionSize: 5, recurrence: null });

    const view = await findTableBySlug(test.db, slug, now);
    expect(view).toMatchObject({ kind: 'open', sessionSize: 5, seatsLeft: 40, everyWeeks: null });
    expect(await loadTableForEdit(test.db, gm, slug, 'America/Sao_Paulo')).toMatchObject({
      kind: 'open',
      sessionSize: '5',
      repeat: '',
    });
  });

  it('may repeat weekly', async () => {
    const { slug } = await createTable(
      test.db,
      gm,
      { ...westmarch, title: 'Marcha semanal', recurrence: 'FREQ=WEEKLY' },
      { now },
    );
    expect(await findTableBySlug(test.db, slug, now)).toMatchObject({ everyWeeks: 1 });
  });
});
