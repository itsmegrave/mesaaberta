import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Extension, WidgetAnswer } from '@mesaaberta/core/server/extensions/index';
import { widgetViewer } from '#lib/server/widgets.js';
import { actions, load } from './+page.server';

const results = { id: 'p1', kind: 'poll', data: { total: 12 } };
const page = vi.fn(async (_db: unknown, id: string) => (id === 'p1' ? results : null));
const respond = vi.fn(async (): Promise<WidgetAnswer | null> => ({
  widget: { ...results, data: { voted: true } },
}));
const fake: Extension = {
  id: 'fake',
  widgets: { forViewer: async () => [], respond, page },
};

vi.mock('@mesaaberta/core/server/extensions/index', () => ({
  extensionById: (id: string) =>
    id === 'fake' ? fake : id === 'bare' ? { id: 'bare' } : undefined,
}));
vi.mock('#lib/extensions/panels.js', () => ({
  widgets: { poll: async () => ({ default: () => null }) },
}));
vi.mock('#lib/server/widgets.js', () => ({ widgetViewer: vi.fn() }));

const viewer = {
  id: 'ana',
  segments: { admin: false, gm: false, player: true, recent: true, new: false },
};
const flags = { isEnabled: async () => true };

const event = ({
  ext = 'fake',
  id = 'p1',
  fields = [] as [string, string][],
  enhanced = true,
} = {}) => {
  const body = new FormData();
  for (const [key, value] of fields) body.append(key, value);
  const url = new URL(`https://x.test/${ext}/w/${id}`);
  return {
    params: { ext, id },
    locals: { db: {}, flags },
    url,
    request: new Request(url, {
      method: 'POST',
      body,
      headers: enhanced ? { 'x-sveltekit-action': 'true' } : {},
    }),
  } as unknown as RequestEvent<{ ext: string; id: string }, '/[ext]/w/[id]'>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape comes back
const run = (fn: unknown, e: unknown) => Promise.resolve((fn as (e: unknown) => any)(e));
const thrown = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error) => error as { status: number; location?: string },
  );
const answer = (e: ReturnType<typeof event>) =>
  run((actions as Record<string, unknown>).respond, e);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(widgetViewer).mockResolvedValue(viewer);
});

describe('a widget’s own page', () => {
  it('shows what the extension makes public, for anyone', async () => {
    expect(await run(load, event())).toEqual({ ext: 'fake', widget: results });
    expect(page).toHaveBeenCalledWith({}, 'p1', flags);
  });

  it('is a 404 without a public page, an extension with widgets, or a component for its kind', async () => {
    expect(await thrown(run(load, event({ id: 'p2' })))).toMatchObject({ status: 404 });
    expect(await thrown(run(load, event({ ext: 'bare' })))).toMatchObject({ status: 404 });
    page.mockResolvedValueOnce({ ...results, kind: 'quiz' });
    expect(await thrown(run(load, event()))).toMatchObject({ status: 404 });
  });
});

describe('answering a widget', () => {
  it('hands the form, without `next`, to the extension and returns the widget as it now stands', async () => {
    const result = await answer(
      event({
        fields: [
          ['option', 'o2'],
          ['next', '/t'],
        ],
      }),
    );
    expect(respond).toHaveBeenCalledWith({}, viewer, 'p1', { option: 'o2' }, flags);
    expect(result).toEqual({ widget: { ...results, data: { voted: true } } });
  });

  it('goes back to the page when the form was sent without JavaScript, never off the site', async () => {
    expect(
      await thrown(answer(event({ enhanced: false, fields: [['next', '/t?page=2']] }))),
    ).toMatchObject({
      status: 303,
      location: '/t?page=2',
    });
    expect(
      await thrown(answer(event({ enhanced: false, fields: [['next', 'https://evil.test']] }))),
    ).toMatchObject({ status: 303, location: '/' });
  });

  it('refuses signed-out people, unknown widgets and invalid answers', async () => {
    vi.mocked(widgetViewer).mockResolvedValueOnce(null);
    expect(await thrown(answer(event()))).toMatchObject({ status: 401 });
    expect(respond).not.toHaveBeenCalled();

    respond.mockResolvedValueOnce(null);
    expect(await thrown(answer(event()))).toMatchObject({ status: 404 });

    respond.mockResolvedValueOnce({ invalid: true });
    expect(await answer(event())).toMatchObject({ status: 400, data: { invalid: true } });

    expect(await thrown(answer(event({ ext: 'bare' })))).toMatchObject({ status: 404 });
  });
});
