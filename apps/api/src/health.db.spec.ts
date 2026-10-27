import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { storeHealth } from './health';

let test: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  test = await createTestDb();
});
afterAll(() => test.close());

const open = (() => ({ db: test.db, close: async () => {} })) as never;

describe('the health of the database and the background Worker', () => {
  it('answers ok, with the worker unknown until its first sweep', async () => {
    expect(await storeHealth({ DATABASE_URL: 'postgres://test' }, open)).toEqual({
      database: 'ok',
      worker: { status: 'unknown', lastRunAt: null, version: null, revision: null },
    });
  });

  it('says not_configured without a database, and down when it does not answer', async () => {
    expect(await storeHealth({}, open)).toEqual({ database: 'not_configured' });
    const broken = (() => ({
      db: { execute: async () => Promise.reject(new Error('refused')) },
      close: async () => {},
    })) as never;
    expect(await storeHealth({ DATABASE_URL: 'postgres://test' }, broken)).toEqual({
      database: 'down',
    });
  });
});
