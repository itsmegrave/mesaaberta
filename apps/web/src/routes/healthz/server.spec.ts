import { describe, expect, it, vi } from 'vitest';

vi.mock('@mesaaberta/core/server/db/health', () => ({ checkDatabase: vi.fn(async () => 'ok') }));
vi.mock('@mesaaberta/core/server/events/heartbeat', () => ({
  workerHealth: vi.fn(async () => ({
    status: 'ok',
    lastRunAt: '2026-10-11T17:55:00.000Z',
    version: '0.61.0',
    revision: 'abc',
  })),
}));

import { checkDatabase } from '@mesaaberta/core/server/db/health';
import { workerHealth } from '@mesaaberta/core/server/events/heartbeat';
import { GET } from './+server';

const call = (env?: Record<string, unknown>) => GET({ locals: { db: {}, log: {}, env } } as never);
const apiAnswering = (answer: () => Promise<Response>) => ({ fetch: vi.fn(answer) });
const healthy = () =>
  Promise.resolve(
    Response.json({ status: 'ok', service: 'api', version: '0.61.0', revision: 'abc' }),
  );

describe('GET /healthz', () => {
  it('reports each app with the build it runs when the pipeline sets it', async () => {
    const response = await call({
      DEPLOYMENT_SOURCE_SHA: ' 40a3e22771d658b31a8fbfdd8f222436b0a6efce ',
      DEPLOYMENT_VERSION: 'v0.61.0',
      API: apiAnswering(healthy),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      database: 'ok',
      // Kept at the top for the deploy smoke and the uptime checks, for one release.
      revision: '40a3e22771d658b31a8fbfdd8f222436b0a6efce',
      web: {
        status: 'ok',
        version: '0.61.0',
        revision: '40a3e22771d658b31a8fbfdd8f222436b0a6efce',
      },
      api: { status: 'ok', version: '0.61.0', revision: 'abc', latencyMs: expect.any(Number) },
      worker: {
        status: 'ok',
        lastRunAt: '2026-10-11T17:55:00.000Z',
        version: '0.61.0',
        revision: 'abc',
      },
    });
  });

  it('omits the top-level revision and says the api is unbound when nothing is configured', async () => {
    const body = await (await call({})).json();
    expect(body).not.toHaveProperty('revision');
    expect(body).toMatchObject({
      web: { status: 'ok', version: null, revision: null },
      api: { status: 'unbound' },
    });
    expect(await (await call()).json()).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('reports a failing or refusing api as down, still answering 200', async () => {
    for (const answer of [
      () => Promise.reject(new Error('timeout')),
      () => Promise.resolve(Response.json({ error: 'internal_error' }, { status: 500 })),
    ]) {
      const response = await call({ API: apiAnswering(answer) });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: 'ok', api: { status: 'down' } });
    }
  });

  it('keeps answering 503 with the revision when the database is down', async () => {
    vi.mocked(checkDatabase).mockResolvedValueOnce('down');
    const response = await call({ DEPLOYMENT_SOURCE_SHA: 'abc' });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'error', revision: 'abc' });
    expect(body).not.toHaveProperty('worker');
  });

  it('reports a stale background worker without failing the probe', async () => {
    vi.mocked(workerHealth).mockResolvedValueOnce({
      status: 'stale',
      lastRunAt: '2026-10-11T10:00:00.000Z',
      version: null,
      revision: null,
    });
    const response = await call({});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', worker: { status: 'stale' } });
  });
});
