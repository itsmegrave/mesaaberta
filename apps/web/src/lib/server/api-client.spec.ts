import { describe, expect, it, vi } from 'vitest';
import { callApi, callApiRaw } from './api-client';

const log = { warn: vi.fn() } as never;
const envWith = (fetch: (request: Request) => Promise<Response>) =>
  ({ API: { fetch } }) as unknown as App.Locals['env'];

describe('callApi', () => {
  it('is null without the binding, so the caller keeps the web path', async () => {
    expect(await callApi(undefined, '/v1/x', 'a', log)).toBeNull();
    expect(await callApi({} as App.Locals['env'], '/v1/x', 'a', log)).toBeNull();
  });

  it('posts as the actor and returns the JSON body', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({ outcome: 'processed' }));
    const result = await callApi(envWith(fetch), '/v1/admin/events/e1/force', 'a', log);

    expect(result).toEqual({ outcome: 'processed' });
    const request = fetch.mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(request.headers.get('x-actor-id')).toBe('a');
    expect(new URL(request.url).pathname).toBe('/v1/admin/events/e1/force');
  });

  it('is null on a refusal or a network error, and never throws', async () => {
    const refused = envWith(async () => Response.json({ error: 'forbidden' }, { status: 403 }));
    const broken = envWith(async () => {
      throw new Error('boom');
    });

    expect(await callApi(refused, '/v1/x', 'a', log)).toBeNull();
    expect(await callApi(broken, '/v1/x', 'a', log)).toBeNull();
  });

  it('callApiRaw sends a JSON body and returns a refusal instead of hiding it', async () => {
    const fetch = vi.fn(async (_request: Request) =>
      Response.json({ error: 'invalid', field: 'name' }, { status: 400 }),
    );
    const answer = await callApiRaw(envWith(fetch), '/v1/admin/catalog/create', 'a', log, {
      kind: 'platform',
      name: 'X',
    });

    expect(answer).toEqual({ ok: false, status: 400, body: { error: 'invalid', field: 'name' } });
    const request = fetch.mock.calls[0][0];
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(await request.json()).toEqual({ kind: 'platform', name: 'X' });
  });

  it('callApiRaw is null when nothing answered, so the caller keeps its own path', async () => {
    const broken = envWith(async () => {
      throw new Error('boom');
    });

    expect(await callApiRaw(undefined, '/v1/x', 'a', log)).toBeNull();
    expect(await callApiRaw(broken, '/v1/x', 'a', log)).toBeNull();
  });
});
