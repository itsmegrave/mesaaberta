import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'devalue';
import { listInbox } from '$lib/server/messages/service';
import { GET } from './+server';
vi.mock('$lib/server/messages/service', () => ({ listInbox: vi.fn() }));
vi.mock('$lib/server/messages/present', () => ({
  inboxWithPictures: (_url: unknown, items: unknown) => items,
}));
const run = (page = '1', user: { id: string } | null = { id: 'viewer' }, kind?: string) =>
  GET({
    locals: { getUser: async () => user, db: {} },
    url: new URL(`https://x.test/api/messages/inbox?page=${page}${kind ? `&kind=${kind}` : ''}`),
  } as unknown as Parameters<typeof GET>[0]);
beforeEach(() => {
  vi.resetAllMocks();
});
describe('drawer inbox', () => {
  it('rejects anonymous requests before accessing conversations', async () => {
    await expect(run('1', null)).rejects.toMatchObject({ status: 401 });
    expect(listInbox).not.toHaveBeenCalled();
  });
  it('uses the authenticated viewer and preserves dates in a private response', async () => {
    const data = {
      items: [{ lastMessageAt: new Date('2026-09-30T12:00:00Z') }],
      page: 2,
      pages: 3,
    };
    vi.mocked(listInbox).mockResolvedValue(
      data as unknown as Awaited<ReturnType<typeof listInbox>>,
    );
    const response = await run('2');
    expect(listInbox).toHaveBeenCalledWith({}, 'viewer', 2, undefined);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-query-viewer')).toBe('viewer');
    expect(parse(await response.text())).toEqual(data);
  });
  it('normalizes invalid pagination', async () => {
    vi.mocked(listInbox).mockResolvedValue({
      items: [],
      page: 1,
      pages: 1,
      total: 0,
      unreadByKind: { direct: 0, table: 0 },
    } as Awaited<ReturnType<typeof listInbox>>);
    await run('-1');
    expect(listInbox).toHaveBeenCalledWith({}, 'viewer', 1, undefined);
  });
  it('filters by kind for the drawer’s tabs, and ignores a kind it does not know', async () => {
    vi.mocked(listInbox).mockResolvedValue({
      items: [],
      page: 1,
      pages: 1,
      total: 0,
      unreadByKind: { direct: 0, table: 0 },
    } as Awaited<ReturnType<typeof listInbox>>);

    await run('1', { id: 'viewer' }, 'table');
    expect(listInbox).toHaveBeenLastCalledWith({}, 'viewer', 1, 'table');
    await run('1', { id: 'viewer' }, 'direct');
    expect(listInbox).toHaveBeenLastCalledWith({}, 'viewer', 1, 'direct');
    await run('1', { id: 'viewer' }, 'everything');
    expect(listInbox).toHaveBeenLastCalledWith({}, 'viewer', 1, undefined);
  });
});
