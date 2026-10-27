import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

// The api Worker reads the feed and marks them; it answers the opened notification's link, when
// it has one, and a 404 past the last page.
let link: string | null = null;
let pastTheEnd = false;
const api = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/v1/me/notifications') return Response.json({ eventIds: [], link });
  if (pastTheEnd) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({
    items: [{ id: n1, createdAt: '2026-10-01T10:00:00.000Z', readAt: null }],
    page: Number(url.searchParams.get('page') ?? 1),
    pages: 3,
    unreadTotal: 3,
  });
});
/** The feed's query string as the load asked the api. */
const feedQuery = () => {
  const request = api.mock.calls.map(([r]) => r).findLast((r) => r.url.includes('/v1/me/'));
  return request ? Object.fromEntries(new URL(request.url).searchParams) : null;
};
/** What the action asked the api: the route and the body, or nothing. */
const asked = async () => {
  const request = api.mock.lastCall?.[0];
  return request ? { path: new URL(request.url).pathname, body: await request.json() } : null;
};

const user = { id: 'me' };
const n1 = '0f8fad5b-d9cb-469f-a165-70867728950e';
const locals = (signedIn = true) => ({
  db: {},
  getUser: async () => (signedIn ? user : null),
  getProfile: async () => ({ id: 'me', username: 'ana' }),
  flags: { isEnabled: async () => false },
  env: { API: { fetch: api } },
  log: { warn: vi.fn() },
});

const event = (search = '', form: Record<string, string> = {}, signedIn = true) =>
  ({
    locals: locals(signedIn),
    url: new URL(`https://x.test/n${search}`),
    request: new Request('https://x.test/n', {
      method: 'POST',
      body: new URLSearchParams(form),
    }),
  }) as unknown as RequestEvent;

/** Where an action redirects to (SvelteKit throws the redirect). */
const location = async (run: Promise<unknown>) => {
  try {
    await run;
  } catch (thrown) {
    return (thrown as { location?: string }).location;
  }
  throw new Error('expected a redirect');
};

// The generated route types want a full event; these tests pass a partial one.
const act = (name: keyof typeof actions, e: RequestEvent) =>
  (actions[name] as unknown as (e: RequestEvent) => Promise<unknown>)(e);

beforeEach(() => {
  vi.clearAllMocks();
  link = null;
  pastTheEnd = false;
});

describe('load', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
  const run = (search: string) => load(event(search) as any) as Promise<any>;

  it('lists the viewer’s notifications, filtered by a known category', async () => {
    const result = await run('?category=rating');
    expect(result.category).toBe('rating');
    expect(feedQuery()).toEqual({ category: 'rating' });
    expect(api.mock.lastCall?.[0].headers.get('x-actor-id')).toBe('me');
    // JSON turned the dates into strings; the page gets them as dates.
    expect(result.notifications[0].createdAt).toEqual(new Date('2026-10-01T10:00:00Z'));
  });

  it('ignores a category it does not know', async () => {
    expect((await run('?category=nope')).category).toBeNull();
    expect(feedQuery()).toEqual({});
  });

  it('includes the badge notices only where the badges are released', async () => {
    expect((await run('')).withAchievements).toBe(false);

    const on = { ...locals(), flags: { isEnabled: async () => true } };
    const result = (await load({
      ...event(''),
      locals: on,
    } as never)) as { withAchievements: boolean };
    expect(result.withAchievements).toBe(true);
    expect(feedQuery()).toEqual({ achievements: '1' });
  });

  it('reads the page and the unread filter from the query, a bad page as the first', async () => {
    const result = await run('?category=table&unread=1&page=2');
    expect(result).toMatchObject({ page: 2, unread: true, unreadTotal: 3 });
    expect(Number.isNaN(Date.parse(result.seenAt))).toBe(false);
    expect(feedQuery()).toEqual({ page: '2', category: 'table', unread: '1' });
    // The page travels as written: the api reads a bad one as the first.
    await run('?page=abc');
    expect(feedQuery()).toEqual({ page: 'abc' });
  });

  it('answers 404 past the last page', async () => {
    pastTheEnd = true;
    await expect(run('?page=9')).rejects.toMatchObject({ status: 404 });
  });

  it('sends an anonymous visitor to log in', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial event
    expect(await location(load(event('', {}, false) as any) as Promise<unknown>)).toMatch(
      /^\/login\?next=/,
    );
  });
});

describe('actions', () => {
  it('open marks the notification read and follows its link', async () => {
    link = '/t/mesa';

    expect(await location(act('open', event('', { id: n1, next: '/tables' })))).toBe('/t/mesa');
    expect(await asked()).toEqual({ path: '/v1/inbox/open', body: { id: n1 } });
    expect(api.mock.lastCall?.[0].headers.get('x-actor-id')).toBe('me');
  });

  it('open comes back to the page when the notification has no link, or is not the viewer’s', async () => {
    expect(await location(act('open', event('', { id: n1, next: '/tables' })))).toBe('/tables');
  });

  it('read marks one read and never leaves the site', async () => {
    expect(await location(act('read', event('', { id: n1, next: 'https://evil.example' })))).toBe(
      '/notifications',
    );
    expect(await asked()).toEqual({ path: '/v1/inbox/read', body: { id: n1 } });
  });

  it('read ignores an id that is not one, and still comes back', async () => {
    expect(await location(act('read', event('', { id: 'n1', next: '/tables' })))).toBe('/tables');
    expect(api).not.toHaveBeenCalled();
  });

  it('readAll marks every one read and goes back', async () => {
    expect(await location(act('readAll', event('', { next: '/u/tables' })))).toBe('/u/tables');
    expect(await asked()).toEqual({ path: '/v1/inbox/readAll', body: {} });
  });

  it('readAll stops at when the page was loaded, so what came later stays unread', async () => {
    const until = '2026-10-25T12:00:00.000Z';
    await location(act('readAll', event('', { next: '/notifications', until })));
    expect(await asked()).toEqual({ path: '/v1/inbox/readAll', body: { until } });
  });

  it('rejects repeated notification ids without discarding a valid return address', async () => {
    const e = event();
    const body = new FormData();
    body.append('id', n1);
    body.append('id', n1);
    body.set('next', '/tables');
    (e as { request: Request }).request = new Request(e.url, { method: 'POST', body });
    expect(await location(act('read', e))).toBe('/tables');
    expect(api).not.toHaveBeenCalled();
  });

  it('marks a valid id even when an oversized return address falls back to the feed', async () => {
    expect(await location(act('read', event('', { id: n1, next: '/' + 'a'.repeat(2000) })))).toBe(
      '/notifications',
    );
    expect(await asked()).toEqual({ path: '/v1/inbox/read', body: { id: n1 } });
  });

  it('answers 503 when the api cannot mark it: nothing is marked here', async () => {
    api.mockResolvedValueOnce(Response.json({ error: 'internal_error' }, { status: 500 }));
    await expect(act('read', event('', { id: n1 }))).rejects.toMatchObject({ status: 503 });
  });
});
