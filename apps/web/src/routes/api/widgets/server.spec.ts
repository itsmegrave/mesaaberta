import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { widgetViewer } from '#lib/server/widgets.js';
import { GET } from './+server';

const poll = { id: 'p1', kind: 'poll', data: { question: 'Qual sistema?' } };
const forViewer = vi.fn(async () => [poll]);
const fake: Extension = {
  id: 'fake',
  widgets: { forViewer, respond: async () => null },
};

vi.mock('@mesaaberta/core/server/extensions/index', () => ({
  widgetExtensions: () => [fake],
}));
vi.mock('#lib/server/widgets.js', () => ({ widgetViewer: vi.fn() }));

const viewer = {
  id: 'ana',
  segments: { admin: false, gm: true, player: false, recent: false, new: false },
};
const flags = { isEnabled: async () => true };

const get = (route: string | null, user: object | null = { id: 'ana' }) => {
  const url = new URL('https://x.test/api/widgets');
  if (route !== null) url.searchParams.set('route', route);
  return GET({
    url,
    locals: { db: {}, flags, getUser: async () => user },
  } as unknown as RequestEvent<Record<string, never>, '/api/widgets'>) as Promise<Response>;
};
const status = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error) => (error as { status: number }).status,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(widgetViewer).mockResolvedValue(viewer);
});

describe('GET /api/widgets', () => {
  it('is for signed-in people only', async () => {
    expect(await status(get('/t', null))).toBe(401);
  });

  it('asks each extension for this person and page, and names the extension of each widget', async () => {
    const response = await get('/t/[slug]');
    expect(await response.json()).toEqual({ widgets: [{ ext: 'fake', widget: poll }] });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(forViewer).toHaveBeenCalledWith({}, viewer, '/t/[slug]', flags);
  });

  it('answers nothing where widgets never show, or for someone nothing is aimed at', async () => {
    expect(await (await get('/admin')).json()).toEqual({ widgets: [] });
    expect(await (await get(null)).json()).toEqual({ widgets: [] });
    vi.mocked(widgetViewer).mockResolvedValue(null);
    expect(await (await get('/t')).json()).toEqual({ widgets: [] });
    expect(forViewer).not.toHaveBeenCalled();
  });
});
