import { describe, expect, it, vi } from 'vitest';

import { GET } from './+server';

const TOKEN = 'health-s3cret';
const asked = (authorization?: string) =>
  new Request('https://mesaaberta.test/healthz', {
    headers: authorization ? { authorization } : {},
  });
/** As the deploy gate asks: with the token configured and sent. */
const call = (env?: Record<string, unknown>) =>
  GET({
    locals: { log: {}, env: env && { HEALTHZ_TOKEN: TOKEN, ...env } },
    request: asked(`Bearer ${TOKEN}`),
  } as never);
/** As anyone without the token asks. */
const callPublic = (env: Record<string, unknown> | undefined, authorization?: string) =>
  GET({ locals: { log: {}, env }, request: asked(authorization) } as never);
const apiAnswering = (answer: () => Promise<Response>) => ({ fetch: vi.fn(answer) });
const worker = {
  status: 'ok',
  lastRunAt: '2026-10-11T17:55:00.000Z',
  version: '0.61.0',
  revision: 'abc',
};
/** The api's deep answer: its build, the database and the background Worker's last sweep. */
const answering =
  (store: Record<string, unknown> = { database: 'ok', worker }) =>
  () =>
    Promise.resolve(
      Response.json({ status: 'ok', service: 'api', version: '0.61.0', revision: 'abc', ...store }),
    );
const healthy = answering();

describe('GET /healthz', () => {
  it('answers 401 without the token, before any probe runs', async () => {
    const env = { HEALTHZ_TOKEN: TOKEN, DEPLOYMENT_SOURCE_SHA: 'abc', API: apiAnswering(healthy) };
    for (const authorization of [undefined, 'Bearer wrong', TOKEN, `Basic ${TOKEN}`]) {
      const response = await callPublic(env, authorization);
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ error: 'unauthorized' });
      expect(env.API.fetch).not.toHaveBeenCalled();
    }
  });

  it('lets nobody in when no token is configured', async () => {
    for (const env of [{}, { HEALTHZ_TOKEN: '' }, { HEALTHZ_TOKEN: '  ' }, undefined]) {
      expect((await callPublic(env, 'Bearer ')).status).toBe(401);
      expect((await callPublic(env, 'Bearer   ')).status).toBe(401);
    }
  });

  it('reports each app with the build it runs when the pipeline sets it', async () => {
    const API = apiAnswering(healthy);
    const response = await call({
      DEPLOYMENT_SOURCE_SHA: ' 40a3e22771d658b31a8fbfdd8f222436b0a6efce ',
      DEPLOYMENT_VERSION: 'v0.61.0',
      API,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      database: 'ok',
      // The web one, where the deploy gate reads it.
      revision: '40a3e22771d658b31a8fbfdd8f222436b0a6efce',
      web: {
        status: 'ok',
        version: '0.61.0',
        revision: '40a3e22771d658b31a8fbfdd8f222436b0a6efce',
      },
      api: { status: 'ok', version: '0.61.0', revision: 'abc', latencyMs: expect.any(Number) },
      worker,
    });
    // The api answers for the database and the background Worker.
    const [asked] = API.fetch.mock.calls[0] as unknown as [Request];
    expect(new URL(asked.url).search).toBe('?deep=1');
  });

  it('omits the top-level revision and says the api is unbound when nothing is configured', async () => {
    const body = await (await call({})).json();
    expect(body).not.toHaveProperty('revision');
    expect(body).toMatchObject({
      web: { status: 'ok', version: null, revision: null },
      api: { status: 'unbound' },
      database: 'unknown',
      status: 'ok',
    });
  });

  it('reports a failing or refusing api as down, still answering 200', async () => {
    for (const answer of [
      () => Promise.reject(new Error('timeout')),
      () => Promise.resolve(Response.json({ error: 'internal_error' }, { status: 500 })),
    ]) {
      const response = await call({ API: apiAnswering(answer) });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: 'ok',
        database: 'unknown',
        api: { status: 'down' },
      });
    }
  });

  it('keeps answering 503 with the revision when the database is down', async () => {
    const response = await call({
      DEPLOYMENT_SOURCE_SHA: 'abc',
      API: apiAnswering(answering({ database: 'down' })),
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'error', revision: 'abc' });
    expect(body).not.toHaveProperty('worker');
  });

  it('reports a stale background worker without failing the probe', async () => {
    const stale = {
      status: 'stale',
      lastRunAt: '2026-10-11T10:00:00.000Z',
      version: null,
      revision: null,
    };
    const response = await call({
      API: apiAnswering(answering({ database: 'ok', worker: stale })),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', worker: { status: 'stale' } });
  });
});
