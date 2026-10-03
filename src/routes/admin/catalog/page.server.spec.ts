import { describe, expect, it, vi } from 'vitest';
import { listApproved, listCatalogAdmin } from '$lib/server/admin/catalog';
import { load } from './+page.server';

vi.mock('$lib/server/admin/catalog', async (original) => ({
  ...(await original<typeof import('$lib/server/admin/catalog')>()),
  listCatalogAdmin: vi.fn(async (_db, kind, { page, pageSize }) => ({
    rows: [],
    total: 41,
    page,
    pages: 3,
    pageSize,
    counts: { all: 41, active: 40, disabled: 1 },
    kind,
  })),
  listApproved: vi.fn(async () => ({ platform: [{ id: 'p', name: 'Discord' }], tag: [] })),
}));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };
const visit = (search: string, profile: object = admin) =>
  load({
    locals: { db: {}, getUser: async () => ({ id: 'admin' }), getProfile: async () => profile },
    url: new URL(`https://x.test/admin/catalog${search}`),
  } as unknown as Parameters<typeof load>[0]) as Promise<Record<string, unknown>>;

describe('the catalog page', () => {
  it('answers 404 to someone who is not an admin', async () => {
    await expect(visit('', { ...admin, role: 'member' })).rejects.toMatchObject({ status: 404 });
  });

  it('opens on the platforms, and on the tags when asked', async () => {
    expect(await visit('')).toMatchObject({ kind: 'platform' });
    expect(await visit('?kind=tag')).toMatchObject({ kind: 'tag' });
    expect(await visit('?kind=nada')).toMatchObject({ kind: 'platform' });
  });

  it('reads the page from ?page=N: anything that is not a positive whole number is page 1', async () => {
    for (const bad of ['0', '-2', 'abc', '1.5', '', '01x']) {
      await visit(`?page=${bad}`);
      expect(listCatalogAdmin).toHaveBeenLastCalledWith({}, 'platform', {
        query: '',
        page: 1,
        pageSize: 20,
        status: 'all',
        sort: null,
      });
    }
    await visit('?page=2&q=%20roll%20');
    expect(listCatalogAdmin).toHaveBeenLastCalledWith({}, 'platform', {
      query: 'roll',
      page: 2,
      pageSize: 20,
      status: 'all',
      sort: null,
    });
  });

  it('reads the status, the page size and the sort, and ignores what the list does not offer', async () => {
    await visit('?status=disabled&size=50&sort=uses&dir=desc');
    expect(listCatalogAdmin).toHaveBeenLastCalledWith({}, 'platform', {
      query: '',
      page: 1,
      pageSize: 50,
      status: 'disabled',
      sort: { id: 'uses', dir: 'desc' },
    });
    await visit('?status=nada&size=7&sort=slug');
    expect(listCatalogAdmin).toHaveBeenLastCalledWith({}, 'platform', {
      query: '',
      page: 1,
      pageSize: 20,
      status: 'all',
      sort: null,
    });
  });

  it('answers 404 to a page past the last', async () => {
    await expect(visit('?page=4')).rejects.toMatchObject({ status: 404 });
    await expect(visit('?page=3')).resolves.toBeTruthy();
    expect(listApproved).toBeDefined();
  });
});
