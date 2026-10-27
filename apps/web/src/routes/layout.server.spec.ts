import type { ServerLoadEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { load } from './+layout.server';

const event = (getProfile: () => Promise<unknown>) => {
  const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn() };
  return {
    log,
    event: {
      route: { id: '/tables' },
      cookies: { get: () => undefined },
      url: new URL('https://x.test/tables'),
      params: {},
      locals: {
        env: {},
        supabase: null,
        log,
        maintenance: undefined,
        getProfile,
        getUser: async () => null,
        db: null,
      },
    } as unknown as ServerLoadEvent,
  };
};

const run = (e: ServerLoadEvent) =>
  (load as unknown as (e: ServerLoadEvent) => Promise<{ account: unknown }>)(e);

describe('the layout load', () => {
  it('shows the page without the account menu and reports the failure', async () => {
    const { event: e, log } = event(async () => {
      throw new Error('boom');
    });

    const data = await run(e);

    expect(data.account).toBeNull();
    expect(log.error).toHaveBeenCalledWith('layout: could not load the profile', expect.anything());
  });
});

describe('the account menu', () => {
  it('reads the bell and the messages link from the api', async () => {
    const api = vi.fn(async () =>
      Response.json({
        unread: 2,
        latest: [{ id: 'n', createdAt: '2026-10-01T10:00:00.000Z', readAt: null }],
        messagesUnread: 1,
        pendingSuggestions: 0,
      }),
    );
    const { event: e } = event(async () => ({
      id: 'u',
      username: 'ana',
      role: 'member',
      status: 'active',
    }));
    Object.assign(e.locals, {
      env: { API: { fetch: api } },
      getUser: async () => ({ id: 'u' }),
      flags: { isEnabled: async () => false },
    });

    const data = (await run(e)) as unknown as {
      account: {
        notifications: { unread: number; latest: { createdAt: Date }[] };
        messagesUnread: number;
      };
    };

    expect(new URL((api.mock.calls[0] as unknown as [Request])[0].url).pathname).toBe(
      '/v1/me/shell',
    );
    expect(data.account.notifications.unread).toBe(2);
    expect(data.account.notifications.latest[0].createdAt).toEqual(
      new Date('2026-10-01T10:00:00Z'),
    );
    expect(data.account.messagesUnread).toBe(1);
  });
});
