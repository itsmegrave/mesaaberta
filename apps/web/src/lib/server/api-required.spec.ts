import { describe, expect, it, vi } from 'vitest';
import { requireApi, requireApiWrite } from './api-required';

const actor = {
  id: '10000000-0000-4000-8000-000000000001',
  role: 'member',
  status: 'active',
} as const;
const localsWith = (fetch?: (request: Request) => Promise<Response>) =>
  ({
    ...(fetch ? { env: { API: { fetch } } } : {}),
    log: { warn: vi.fn() },
    flags: { isEnabled: vi.fn(() => false) },
  }) as unknown as App.Locals;

describe('required API for new features', () => {
  it('sends a draft deletion with DELETE through the required transport', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({ eventIds: ['deleted'] }));
    const locals = localsWith(fetch);
    await requireApiWrite(locals, actor, '/v1/tables/draft/draft', {}, 'DELETE');
    expect(fetch.mock.calls[0][0].method).toBe('DELETE');
    expect(locals.flags.isEnabled).not.toHaveBeenCalled();
  });

  it('reads through API even when migration flags are off', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({ enabled: true }));
    const locals = localsWith(fetch);
    expect(await requireApi(locals, actor, '/v1/account/invitation-preferences')).toEqual({
      enabled: true,
    });
    const request = fetch.mock.calls[0][0];
    expect(request.method).toBe('GET');
    expect(request.headers.get('x-actor-id')).toBe(actor.id);
    expect(locals.flags.isEnabled).not.toHaveBeenCalled();
  });
  it('fails unavailable instead of choosing a local write when API is absent', async () => {
    await expect(
      requireApiWrite(localsWith(), actor, '/v1/tables/x/duplicate', {}),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('preserves domain refusals and rejects an invalid successful mutation envelope', async () => {
    await expect(
      requireApiWrite(
        localsWith(async () => Response.json({ error: 'table_full' }, { status: 409 })),
        actor,
        '/v1/tables/x/invitations',
        {},
      ),
    ).rejects.toMatchObject({ name: 'TableFull' });
    await expect(
      requireApiWrite(
        localsWith(async () => Response.json({ slug: 'x' })),
        actor,
        '/v1/tables/x/duplicate',
        {},
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('writes through API once and returns its committed event ids', async () => {
    const fetch = vi.fn(async (_request: Request) =>
      Response.json({ eventIds: ['e1'], slug: 'copy' }),
    );
    const result = await requireApiWrite(localsWith(fetch), actor, '/v1/tables/x/duplicate', {
      draft: true,
    });
    expect(result).toEqual({ eventIds: ['e1'], body: { eventIds: ['e1'], slug: 'copy' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].method).toBe('POST');
    expect(await fetch.mock.calls[0][0].json()).toEqual({ draft: true });
  });
});
