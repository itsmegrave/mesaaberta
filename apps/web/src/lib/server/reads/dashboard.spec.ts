import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPlaying, listRunning } from '$lib/server/dashboard/queries';
import { DASHBOARD_PAGE_SIZE, read } from './dashboard';

vi.mock('$lib/server/dashboard/queries', () => ({
  listPlaying: vi.fn(),
  listRunning: vi.fn(),
}));

const table = (n: number, requests = 0) => ({
  slug: `mesa-${n}`,
  title: `Mesa ${n}`,
  requests: Array.from({ length: requests }, (_, i) => ({ playerId: `p${i}`, username: `p${i}` })),
});
const event = (search = '') =>
  ({
    locals: {
      db: {},
      getUser: async () => ({ id: 'gm' }),
      getProfile: async () => ({ id: 'gm', username: 'gm' }),
    },
    url: new URL(`https://x.test/account/tables${search}`),
  }) as unknown as RequestEvent;

beforeEach(() => {
  vi.mocked(listPlaying).mockResolvedValue([table(100)] as never);
  vi.mocked(listRunning).mockResolvedValue(
    Array.from({ length: DASHBOARD_PAGE_SIZE + 3 }, (_, i) =>
      table(i, i === DASHBOARD_PAGE_SIZE + 1 ? 2 : 0),
    ) as never,
  );
});

describe('the Minhas mesas read', () => {
  it('slices both lists by ?page=N and counts every table', async () => {
    const first = await read(event());
    expect(first).toMatchObject({ page: 1, pages: 2, totals: { playing: 1, running: 13 } });
    expect(first.running).toHaveLength(DASHBOARD_PAGE_SIZE);

    const second = await read(event('?page=2'));
    expect(second.running.map((item) => item.slug)).toEqual(['mesa-10', 'mesa-11', 'mesa-12']);
    expect(second.playing).toEqual([]);
  });

  it('points the requests banner at the page the waiting table is on', async () => {
    const { waiting } = await read(event());
    expect(waiting).toEqual({
      requests: 2,
      tables: 1,
      first: { slug: 'mesa-11', title: 'Mesa 11', page: 2 },
    });
  });

  it('reads anything but a positive whole number as page 1, and 404s past the last', async () => {
    expect((await read(event('?page=abc'))).page).toBe(1);
    await expect(read(event('?page=3'))).rejects.toMatchObject({ status: 404 });
  });
});
