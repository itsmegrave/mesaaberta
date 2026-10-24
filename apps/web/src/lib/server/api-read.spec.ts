import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { readViaApi } from './api-read';

const viewer = {
  id: '00000000-0000-4000-8000-0000000007a1',
  role: 'member',
  status: 'active',
} as Actor;
const locals = (flag: boolean, fetch?: (request: Request) => Promise<Response>) =>
  ({
    env: fetch ? { API: { fetch } } : {},
    flags: { isEnabled: vi.fn(async () => flag) },
    log: { warn: vi.fn() },
  }) as unknown as App.Locals;
const read = (l: App.Locals) =>
  readViaApi<{ n: number }>(l, 'api_reads_catalog', viewer, '/v1/reads/catalog');

describe('readViaApi', () => {
  it('stays in this Worker with the flag off, never calling the api', async () => {
    const fetch = vi.fn();
    expect(await read(locals(false, fetch))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns what the api answered, asking as the viewer with a GET', async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(request.method).toBe('GET');
      expect(request.headers.get('x-actor-id')).toBe(viewer.id);
      return Response.json({ n: 3 });
    });

    expect(await read(locals(true, fetch))).toEqual({ n: 3 });
  });

  it('falls back, and says so once, when the api refuses', async () => {
    const l = locals(true, async () => Response.json({ error: 'forbidden' }, { status: 403 }));

    expect(await read(l)).toBeNull();
    expect(l.log.warn).toHaveBeenCalledWith(
      'api read not used',
      expect.objectContaining({ code: 'api_call_refused', status: 403 }),
    );
  });

  it('falls back when there is no way to reach the api', async () => {
    expect(await read(locals(true))).toBeNull();
  });
});
