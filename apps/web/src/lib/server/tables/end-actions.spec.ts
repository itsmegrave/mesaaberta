import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { endActions } from './end-actions';

const event = (fetch?: (request: Request) => Promise<Response>) =>
  ({
    locals: {
      env: fetch ? { API: { fetch } } : {},
      log: { warn: vi.fn() },
      getUser: async () => ({ id: 'gm' }),
      getProfile: async () => ({ id: 'gm', username: 'mestre', role: 'member', status: 'active' }),
      flags: { isEnabled: vi.fn(() => false) },
      afterResponse: vi.fn(),
    },
    url: new URL('https://x.test/tables/draft/manage'),
    params: { slug: 'private draft' },
    request: new Request('https://x.test/tables/draft/manage?/deleteDraft', { method: 'POST' }),
  }) as unknown as RequestEvent;

describe('table end form adapters', () => {
  it.each(['deleteDraft', 'close'] as const)(
    'fails %s with an unavailable API even with no local database',
    async (action) => {
      await expect(endActions[action](event())).rejects.toMatchObject({ status: 503 });
    },
  );
  it.each([
    ['deleteDraft', 'DELETE', 'draft'],
    ['close', 'POST', 'close'],
  ] as const)(
    'adapts %s once and dispatches only committed events',
    async (action, method, suffix) => {
      const send = vi.fn(async (_request: Request) => Response.json({ eventIds: ['event'] }));
      const request = event(send);
      await expect(endActions[action](request)).rejects.toMatchObject({
        status: 303,
        location: '/account/tables',
      });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0].method).toBe(method);
      expect(new URL(send.mock.calls[0][0].url).pathname).toBe(
        `/v1/tables/private%20draft/${suffix}`,
      );
      expect(request.locals.afterResponse).toHaveBeenCalledTimes(1);
      expect(request.locals.flags.isEnabled).not.toHaveBeenCalled();
    },
  );
});
