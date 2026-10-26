import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import { setRequestContextStore, withRequestId } from '@mesaaberta/contracts';
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

  it('passes the request id on, so the api lines join the web request', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({}));
    setRequestContextStore(new AsyncLocalStorage());
    try {
      await withRequestId('8a1b2c3d4e5f6789-GRU', () => callApi(envWith(fetch), '/v1/x', 'a', log));
      await callApi(envWith(fetch), '/v1/x', 'a', log);
    } finally {
      setRequestContextStore(null);
    }

    expect(fetch.mock.calls[0][0].headers.get('x-request-id')).toBe('8a1b2c3d4e5f6789-GRU');
    expect(fetch.mock.calls[1][0].headers.has('x-request-id')).toBe(false);
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

describe('callApiRaw over HTTP (self-hosted)', () => {
  const env = {
    API_URL: 'http://api:8788/',
    API_INTERNAL_TOKEN: 's3cret',
  } as unknown as App.Locals['env'];

  it('posts to the api address with the shared secret and the actor', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({ eventIds: [] }));
    vi.stubGlobal('fetch', fetch);

    const answer = await callApiRaw(env, '/v1/account/messages', 'a', log, { enabled: false });
    vi.unstubAllGlobals();

    expect(answer).toMatchObject({ ok: true });
    const request = fetch.mock.calls[0][0];
    expect(request.url).toBe('http://api:8788/v1/account/messages');
    expect(request.headers.get('x-internal-token')).toBe('s3cret');
    expect(request.headers.get('x-actor-id')).toBe('a');
  });

  it('is null without the secret, so an unconfigured api is never called', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const answer = await callApiRaw(
      { API_URL: 'http://api:8788' } as unknown as App.Locals['env'],
      '/v1/x',
      'a',
      log,
    );
    vi.unstubAllGlobals();

    expect(answer).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never sends the secret over a Service Binding', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({}));
    await callApiRaw(
      { API: { fetch }, API_INTERNAL_TOKEN: 's3cret' } as unknown as App.Locals['env'],
      '/v1/x',
      'a',
      log,
    );

    expect(fetch.mock.calls[0][0].headers.get('x-internal-token')).toBeNull();
  });
});
