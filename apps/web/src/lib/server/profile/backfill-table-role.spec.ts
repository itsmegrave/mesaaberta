import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { gameTables, profiles, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';

// The data migration that starts Quem mestra with the people who already ran a table.
const backfill = readFileSync('../../drizzle/0067_backfill_table_role.sql', 'utf8');

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000066${String(n).padStart(2, '0')}`;
let tableCount = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'mestrou' },
    { id: id(2), username: 'so-rascunho' },
    { id: id(3), username: 'ja-respondeu', tableRole: 'player' },
    { id: id(4), username: 'nunca-mestrou' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const table = (gm: number, values: Partial<typeof gameTables.$inferInsert> = {}) => ({
    slug: `backfill-${++tableCount}`,
    title: `Mesa ${tableCount}`,
    kind: 'one_shot' as const,
    capacity: 4,
    startsAt: new Date('2026-09-10T20:00:00Z'),
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: id(gm),
    systemId: system.id,
    publishedAt: new Date('2026-09-01T20:00:00Z'),
    status: 'concluded' as const,
    ...values,
  });
  await test.db
    .insert(gameTables)
    .values([table(1), table(2, { status: 'draft', publishedAt: null }), table(3)]);
});
afterAll(() => test.close());

const roles = async () =>
  Object.fromEntries(
    (
      await test.db
        .select({
          username: profiles.username,
          tableRole: profiles.tableRole,
          inferred: profiles.tableRoleInferred,
        })
        .from(profiles)
    ).map((row) => [row.username, { tableRole: row.tableRole, inferred: row.inferred }]),
  );

describe('the table_role backfill', () => {
  it('lists only people with a published table and no answer, marked as inferred', async () => {
    await test.db.execute(sql.raw(backfill));
    expect(await roles()).toMatchObject({
      mestrou: { tableRole: 'gm', inferred: true },
      'so-rascunho': { tableRole: null, inferred: false },
      'ja-respondeu': { tableRole: 'player', inferred: false },
      'nunca-mestrou': { tableRole: null, inferred: false },
    });
  });

  it('changes nothing when it runs again', async () => {
    const before = await roles();
    await test.db.execute(sql.raw(backfill));
    expect(await roles()).toEqual(before);
  });
});
