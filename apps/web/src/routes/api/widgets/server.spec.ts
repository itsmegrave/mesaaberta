import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { viewerSegments } from '@mesaaberta/core/server/audience/segments';
import { actorsOnly, apiOver } from '#lib/server/db/test-api.js';
import { GET } from './+server';

const poll = { id: 'p1', kind: 'poll', data: { question: 'Qual sistema?' } };
const forViewer = vi.fn(async () => [poll]);
const fake: Extension = {
  id: 'fake',
  widgets: { forViewer, respond: async () => null },
};

vi.mock('@mesaaberta/core/server/extensions/index', async (original) => ({
  ...(await original<object>()),
  widgetExtensions: () => [fake],
}));
vi.mock('@mesaaberta/core/server/audience/segments', () => ({ viewerSegments: vi.fn() }));

const viewer = {
  id: 'ana',
  segments: {
    admin: false,
    gm: true,
    player: false,
    recent: false,
    new: false,
    has_passkey: false,
    no_passkey: true,
  },
  signedIn: false,
};

/** The request's cookies, with the sign-in mark when `signedIn`. */
const jar = (signedIn = false) => {
  const cookies = new Map<string, string>(signedIn ? [['ma_signed_in', '1']] : []);
  return {
    cookies,
    get: (name: string) => cookies.get(name),
    delete: (name: string) => void cookies.delete(name),
  };
};

const get = (
  route: string | null,
  user: object | null = { id: 'ana' },
  cookies: ReturnType<typeof jar> = jar(),
) => {
  const url = new URL('https://x.test/api/widgets');
  if (route !== null) url.searchParams.set('route', route);
  return GET({
    url,
    cookies,
    locals: {
      getUser: async () => user,
      getProfile: async () => user && { id: 'ana', role: 'member', status: 'active' },
      env: apiOver(actorsOnly([{ id: 'ana', role: 'member', status: 'active' }])),
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    },
  } as unknown as RequestEvent<Record<string, never>, '/api/widgets'>) as Promise<Response>;
};
const status = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error) => (error as { status: number }).status,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(viewerSegments).mockResolvedValue(viewer.segments);
});

describe('GET /api/widgets', () => {
  it('is for signed-in people only', async () => {
    expect(await status(get('/tables', null))).toBe(401);
  });

  it('asks each extension for this person and page, and names the extension of each widget', async () => {
    const response = await get('/t/[slug]');
    expect(await response.json()).toEqual({ widgets: [{ ext: 'fake', widget: poll }] });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(forViewer).toHaveBeenCalledWith(
      expect.anything(),
      viewer,
      '/t/[slug]',
      expect.anything(),
    );
  });

  it('tells the first page after a sign-in so, once', async () => {
    const cookies = jar(true);
    await get('/admin', undefined, cookies);
    // A page without widgets leaves the mark for the next one.
    expect(cookies.cookies.has('ma_signed_in')).toBe(true);
    await get('/', undefined, cookies);
    expect(forViewer).toHaveBeenLastCalledWith(
      expect.anything(),
      { ...viewer, signedIn: true },
      '/',
      expect.anything(),
    );
    expect(cookies.cookies.has('ma_signed_in')).toBe(false);
    await get('/tables', undefined, cookies);
    expect(forViewer).toHaveBeenLastCalledWith(
      expect.anything(),
      viewer,
      '/tables',
      expect.anything(),
    );
  });

  it('answers nothing where widgets never show, or for someone nothing is aimed at', async () => {
    expect(await (await get('/admin')).json()).toEqual({ widgets: [] });
    expect(await (await get(null)).json()).toEqual({ widgets: [] });
    vi.mocked(viewerSegments).mockResolvedValue(null);
    expect(await (await get('/tables')).json()).toEqual({ widgets: [] });
    expect(forViewer).not.toHaveBeenCalled();
  });
});
