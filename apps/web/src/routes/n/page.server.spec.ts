import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listNotifications,
  markAllRead,
  markRead,
} from '@mesaaberta/core/server/notifications/service';
import { actions, load } from './+page.server';

vi.mock('@mesaaberta/core/server/notifications/service', () => ({
  listNotifications: vi.fn(async () => []),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

const user = { id: 'me' };
const n1 = '0f8fad5b-d9cb-469f-a165-70867728950e';
const locals = (signedIn = true) => ({
  db: {},
  getUser: async () => (signedIn ? user : null),
  getProfile: async () => ({ id: 'me', username: 'ana' }),
  flags: { isEnabled: async () => false },
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

beforeEach(() => vi.clearAllMocks());

describe('load', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
  const run = (search: string) => load(event(search) as any) as Promise<any>;

  it('lists the viewer’s notifications, filtered by a known category', async () => {
    expect((await run('?category=rating')).category).toBe('rating');
    expect(listNotifications).toHaveBeenLastCalledWith({}, 'me', {
      category: 'rating',
      withAchievements: false,
    });
  });

  it('ignores a category it does not know', async () => {
    expect((await run('?category=nope')).category).toBeNull();
    expect(listNotifications).toHaveBeenLastCalledWith({}, 'me', {
      category: undefined,
      withAchievements: false,
    });
  });

  it('includes the badge notices only where the badges are released', async () => {
    expect((await run('')).withAchievements).toBe(false);

    const on = { ...locals(), flags: { isEnabled: async () => true } };
    const result = (await load({
      ...event(''),
      locals: on,
    } as never)) as { withAchievements: boolean };
    expect(result.withAchievements).toBe(true);
    expect(listNotifications).toHaveBeenLastCalledWith({}, 'me', {
      category: undefined,
      withAchievements: true,
    });
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
    vi.mocked(markRead).mockResolvedValueOnce({ link: '/t/mesa' });

    expect(await location(act('open', event('', { id: n1, next: '/t' })))).toBe('/t/mesa');
    expect(markRead).toHaveBeenCalledWith({}, 'me', n1);
  });

  it('open comes back to the page when the notification has no link, or is not the viewer’s', async () => {
    vi.mocked(markRead).mockResolvedValueOnce(null);

    expect(await location(act('open', event('', { id: n1, next: '/t' })))).toBe('/t');
  });

  it('read marks one read and never leaves the site', async () => {
    expect(await location(act('read', event('', { id: n1, next: 'https://evil.example' })))).toBe(
      '/n',
    );
    expect(markRead).toHaveBeenCalledWith({}, 'me', n1);
  });

  it('read ignores an id that is not one, and still comes back', async () => {
    expect(await location(act('read', event('', { id: 'n1', next: '/t' })))).toBe('/t');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('readAll marks every one read and goes back', async () => {
    expect(await location(act('readAll', event('', { next: '/u/tables' })))).toBe('/u/tables');
    expect(markAllRead).toHaveBeenCalledWith({}, 'me');
  });

  it('rejects repeated notification ids without discarding a valid return address', async () => {
    const e = event();
    const body = new FormData();
    body.append('id', n1);
    body.append('id', n1);
    body.set('next', '/t');
    (e as { request: Request }).request = new Request(e.url, { method: 'POST', body });
    expect(await location(act('read', e))).toBe('/t');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('marks a valid id even when an oversized return address falls back to the feed', async () => {
    expect(await location(act('read', event('', { id: n1, next: '/' + 'a'.repeat(2000) })))).toBe(
      '/n',
    );
    expect(markRead).toHaveBeenCalledWith({}, 'me', n1);
  });
});
