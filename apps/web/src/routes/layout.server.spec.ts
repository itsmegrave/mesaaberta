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
  it('shows the page without the account menu when the request already ended, and does not call it an error', async () => {
    const ended = Object.assign(new Error('write CONNECTION_ENDED'), { code: 'CONNECTION_ENDED' });
    const { event: e, log } = event(async () => {
      throw Object.assign(new Error('Failed query'), { cause: ended });
    });

    const data = await run(e);

    expect(data.account).toBeNull();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('request ended'));
  });

  it('still reports any other failure as an error', async () => {
    const { event: e, log } = event(async () => {
      throw new Error('boom');
    });

    const data = await run(e);

    expect(data.account).toBeNull();
    expect(log.error).toHaveBeenCalledWith('layout: could not load the profile', expect.anything());
  });
});
