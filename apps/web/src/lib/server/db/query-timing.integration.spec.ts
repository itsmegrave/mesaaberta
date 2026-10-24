import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb } from '@mesaaberta/core/server/db/client';

// Against the real driver: the wrapper has to hold for what Drizzle actually calls on postgres.js.
const seen: number[] = [];
const { db, close } = createDb(process.env.DATABASE_URL!, {
  onQuery: (seconds) => seen.push(seconds),
});

afterAll(() => close());

describe('createDb with onQuery', () => {
  it('times a plain query and still returns its rows', async () => {
    seen.length = 0;
    const rows = await db.execute(sql`select 1 as n`);

    expect(Array.from(rows)).toEqual([{ n: 1 }]);
    expect(seen).toHaveLength(1);
  });

  it('times the queries of a transaction, and the commit leaves the result intact', async () => {
    seen.length = 0;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select 1`);
      const rows = await tx.execute(sql`select 2 as n`);
      return Array.from(rows);
    });

    expect(result).toEqual([{ n: 2 }]);
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });

  it('reports a failing query and rethrows it', async () => {
    seen.length = 0;
    await expect(db.execute(sql`select * from no_such_table_for_timing`)).rejects.toThrow();
    expect(seen).toHaveLength(1);
  });
});
