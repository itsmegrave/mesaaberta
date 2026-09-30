import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '$lib/server/errors';
import { retryEvent } from '$lib/server/admin/operations';
import { actions, load } from './+page.server';

vi.mock('$lib/server/admin/operations', () => ({
  queueHealth: vi.fn(async () => ({})),
  listWork: vi.fn(async () => []),
  retryEvent: vi.fn(async () => 'audit-1'),
}));
vi.mock('$lib/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };
const event = (
  env: Record<string, string> | undefined,
  profile: object = admin,
  id = '00000000-0000-4000-8000-0000000000e1',
) =>
  ({
    locals: {
      db: {},
      getUser: async () => ({ id: 'admin' }),
      getProfile: async () => profile,
      afterResponse: () => {},
    },
    url: new URL('https://x.test/admin/operations'),
    platform: env && { env },
    request: new Request('https://x.test/admin/operations', {
      method: 'POST',
      body: new URLSearchParams({ id }),
    }),
  }) as never;

beforeEach(() => vi.clearAllMocks());

describe('operations', () => {
  it('is for admins only', async () => {
    await expect(load(event({}, { ...admin, role: 'member' }))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('is read-only unless ADMIN_QUEUE_RETRY is "true"', async () => {
    expect(await load(event({}))).toMatchObject({ canRetry: false });
    expect(await load(event({ ADMIN_QUEUE_RETRY: 'true' }))).toMatchObject({ canRetry: true });
    await expect(actions.retry(event({}))).rejects.toMatchObject({ status: 404 });
    await expect(actions.retry(event(undefined))).rejects.toMatchObject({ status: 404 });
    expect(retryEvent).not.toHaveBeenCalled();
  });

  it('retries the event asked for, and says why when it cannot', async () => {
    const ok = await actions.retry(event({ ADMIN_QUEUE_RETRY: 'true' }));
    expect(ok).toMatchObject({ form: { valid: true } });
    expect(retryEvent).toHaveBeenCalledWith({}, admin, '00000000-0000-4000-8000-0000000000e1');

    vi.mocked(retryEvent).mockRejectedValueOnce(new Invalid('id', 'not_retryable'));
    const refused = (await actions.retry(event({ ADMIN_QUEUE_RETRY: 'true' }))) as {
      status: number;
      data: { form: { errors: { _errors: string[] } } };
    };
    expect(refused.status).toBe(400);
    expect(refused.data.form.errors._errors).toEqual(['not_retryable']);

    const bad = (await actions.retry(event({ ADMIN_QUEUE_RETRY: 'true' }, admin, 'nope'))) as {
      status: number;
    };
    expect(bad.status).toBe(400);
  });
});
