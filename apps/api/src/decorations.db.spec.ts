import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { decorationRoutes } from './decorations';

let test: Awaited<ReturnType<typeof createTestDb>>;
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
});
afterAll(() => test.close());

const opened = vi.fn();
const app = (installed: readonly Extension[]) =>
  decorationRoutes(
    (() => {
      opened();
      return { db: test.db, close: async () => {} };
    }) as never,
    installed,
  );

describe('/v1/decorations', () => {
  it('answers an empty map without the database when no extension decorates', async () => {
    opened.mockClear();
    const res = await app([{ id: 'plain' }]).request('/?u=ana', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ decorations: {} });
    expect(opened).not.toHaveBeenCalled();
  });

  it('answers what the extensions draw on the people asked about, signed out too', async () => {
    const forPeople = vi.fn(async () => ({ ana: { avatar: { kind: 'frame', data: { k: 1 } } } }));
    const res = await app([{ id: 'deco', decorations: { forPeople } }]).request(
      '/?u=Ana,bia',
      {},
      env,
    );
    expect(await res.json()).toEqual({
      decorations: { ana: { avatar: { kind: 'frame', data: { k: 1 } } } },
    });
    expect(forPeople.mock.calls[0][1]).toEqual(['ana', 'bia']);
  });
});
