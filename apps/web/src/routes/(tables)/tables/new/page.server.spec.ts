import { describe, expect, it, vi } from 'vitest';
import { RateLimited } from '@mesaaberta/core/server/errors';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  requireApi: vi.fn(),
  requireApiWrite: vi.fn(),
}));
vi.mock('#lib/server/auth/guard.js', () => ({ requireUser: vi.fn(async () => ({ id: 'gm' })) }));
vi.mock('#lib/server/api-required.js', () => ({
  requireApi: mocks.requireApi,
  requireApiWrite: mocks.requireApiWrite,
}));
vi.mock('@mesaaberta/core/server/rate-limit', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/rate-limit')>()),
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock('#lib/server/tables/form-action.js', () => ({
  handleTableForm: async (
    event: { request: Request },
    save: (input: object, path: undefined, draft: boolean) => Promise<unknown>,
    guard: (draft: boolean, data: FormData) => Promise<void>,
  ) => {
    await guard(false, await event.request.formData());
    return save({}, undefined, false);
  },
}));
import { actions } from './+page.server';

describe('duplicate form submission replay', () => {
  it('reaches API idempotency even when the committed copy exhausted the creation limit', async () => {
    mocks.checkRateLimit.mockRejectedValue(new RateLimited(3600));
    mocks.requireApi.mockResolvedValue({ input: { timezone: 'UTC' } });
    mocks.requireApiWrite.mockResolvedValue({
      body: { slug: 'existing-copy', draft: false },
      eventIds: ['existing-event'],
    });
    const key = crypto.randomUUID();
    const body = new FormData();
    body.set('duplicationRequestKey', key);
    const event = {
      url: new URL('https://example.test/tables/new?duplicate=source'),
      request: new Request('https://example.test/tables/new?duplicate=source', {
        method: 'POST',
        body,
      }),
      locals: {
        db: {},
        getProfile: async () => ({ id: 'gm', role: 'member', status: 'active' }),
        afterResponse: vi.fn(),
      },
    };
    const result = await actions.default!(event as never);
    expect(result).toMatchObject({ slug: 'existing-copy' });
    expect(mocks.requireApiWrite).toHaveBeenCalledWith(
      event.locals,
      expect.any(Object),
      '/v1/tables/source/duplicate',
      expect.objectContaining({ requestKey: key }),
    );
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });
});
