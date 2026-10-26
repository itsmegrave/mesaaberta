import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listNewTables, listUpcomingTables } from '@mesaaberta/core/server/tables/queries';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/tables/queries', () => ({
  listUpcomingTables: vi.fn(),
  listNewTables: vi.fn(),
}));

const listed = vi.mocked(listUpcomingTables);
const fresh = vi.mocked(listNewTables);

const table = (n: number) =>
  ({
    slug: `mesa-${n}`,
    title: `Mesa ${n}`,
    gmId: `gm-${n}`,
    imagePath: null,
  }) as unknown as Awaited<ReturnType<typeof listUpcomingTables>>[number];

const error = vi.fn();
const event = (db: unknown = {}) =>
  ({
    params: {},
    url: new URL('https://x.test/'),
    locals: { db, log: { error }, getProfile: async () => null },
    platform: undefined,
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('the home page load', () => {
  beforeEach(() => {
    listed.mockReset();
    fresh.mockReset();
    fresh.mockResolvedValue([]);
    error.mockReset();
  });

  it('lists nothing when there is no database yet', async () => {
    expect(await run(event(null))).toMatchObject({
      tables: [],
      newTables: [],
      readSeed: { resource: 'preview', viewer: 'public', fields: ['tables', 'newTables', 'now'] },
    });
    expect(listed).not.toHaveBeenCalled();
  });

  it('previews the ten soonest tables, keeping the GM id on the server', async () => {
    listed.mockResolvedValue(Array.from({ length: 10 }, (_, i) => table(i + 1)));

    const { tables } = await run(event());

    // The query reads only the ten it shows; it no longer loads every upcoming table to slice.
    expect(listed).toHaveBeenCalledWith(expect.anything(), expect.any(Date), { limit: 10 });
    expect(tables).toHaveLength(10);
    expect(tables[9].slug).toBe('mesa-10');
    expect(tables[0]).not.toHaveProperty('gmId');
    expect(tables[0]).not.toHaveProperty('imagePath');
  });

  it('lists the new tables apart, with the instant they were read at', async () => {
    listed.mockResolvedValue([table(1)]);
    fresh.mockResolvedValue([table(1), table(2)]);

    const { newTables, now } = await run(event());

    expect(newTables.map((t: { slug: string }) => t.slug)).toEqual(['mesa-1', 'mesa-2']);
    expect(newTables[0]).not.toHaveProperty('gmId');
    expect(now).toBeInstanceOf(Date);
    expect(fresh).toHaveBeenCalledWith(expect.anything(), now, 10);
  });

  it('still renders, without the preview, when the tables cannot be listed', async () => {
    listed.mockRejectedValue(new Error('down'));

    expect(await run(event())).toMatchObject({
      tables: [],
      newTables: [],
      readSeed: { resource: 'preview', viewer: 'public', fields: ['tables', 'newTables', 'now'] },
    });
    expect(error).toHaveBeenCalledOnce();
  });
});
