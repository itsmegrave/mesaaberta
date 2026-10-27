import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'devalue';
import { GET } from './+server';
vi.mock('@mesaaberta/core/server/messages/present', () => ({
  inboxWithPictures: (_url: unknown, items: unknown) => items,
}));

const empty = { items: [], page: 1, pages: 1, total: 0, unreadByKind: { direct: 0, table: 0 } };
const api = vi.fn<(request: Request) => Promise<Response>>();
const run = (page = '1', user: { id: string } | null = { id: 'viewer' }, kind?: string) =>
  GET({
    locals: {
      getUser: async () => user,
      env: { API: { fetch: api } },
      log: { warn: vi.fn() },
    },
    url: new URL(`https://x.test/api/messages/inbox?page=${page}${kind ? `&kind=${kind}` : ''}`),
  } as unknown as Parameters<typeof GET>[0]);
const asked = () => {
  const request = api.mock.lastCall![0];
  const url = new URL(request.url);
  return { path: url.pathname, query: url.search, actor: request.headers.get('x-actor-id') };
};
beforeEach(() => {
  vi.resetAllMocks();
  api.mockImplementation(async () => Response.json(empty));
});
describe('drawer inbox', () => {
  it('rejects anonymous requests before asking the api', async () => {
    await expect(run('1', null)).rejects.toMatchObject({ status: 401 });
    expect(api).not.toHaveBeenCalled();
  });
  it('asks the api as the viewer and gives the dates back in a private response', async () => {
    const data = { ...empty, items: [{ lastMessageAt: '2026-09-30T12:00:00.000Z' }], page: 2 };
    api.mockImplementation(async () => Response.json(data));
    const response = await run('2');
    expect(asked()).toEqual({ path: '/v1/messages/inbox', query: '?page=2', actor: 'viewer' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-query-viewer')).toBe('viewer');
    expect(parse(await response.text())).toEqual({
      ...data,
      items: [{ lastMessageAt: new Date('2026-09-30T12:00:00Z') }],
    });
  });
  it('normalizes invalid pagination', async () => {
    await run('-1');
    expect(asked().query).toBe('?page=1');
  });
  it('filters by kind for the drawer’s tabs, and ignores a kind it does not know', async () => {
    await run('1', { id: 'viewer' }, 'table');
    expect(asked().query).toBe('?page=1&kind=table');
    await run('1', { id: 'viewer' }, 'direct');
    expect(asked().query).toBe('?page=1&kind=direct');
    await run('1', { id: 'viewer' }, 'everything');
    expect(asked().query).toBe('?page=1');
  });
  it('answers a 503 when the api cannot answer', async () => {
    api.mockImplementation(async () => Response.json({ error: 'internal_error' }, { status: 500 }));
    await expect(run('1')).rejects.toMatchObject({ status: 503 });
  });
});
