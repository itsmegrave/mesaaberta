import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db/health', () => ({ checkDatabase: vi.fn(async () => 'ok') }));
vi.mock('$lib/server/events/heartbeat', () => ({
  workerHealth: vi.fn(async () => ({ status: 'ok', lastRunAt: '2026-10-11T17:55:00.000Z' })),
}));

import { checkDatabase } from '$lib/server/db/health';
import { workerHealth } from '$lib/server/events/heartbeat';
import { GET } from './+server';

const call = (env?: Record<string, string>) => GET({ locals: { db: {}, log: {}, env } } as never);

describe('GET /healthz', () => {
  it('reports the deployed source revision when the pipeline sets it', async () => {
    const response = await call({
      DEPLOYMENT_SOURCE_SHA: ' 40a3e22771d658b31a8fbfdd8f222436b0a6efce ',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      database: 'ok',
      revision: '40a3e22771d658b31a8fbfdd8f222436b0a6efce',
      worker: { status: 'ok', lastRunAt: '2026-10-11T17:55:00.000Z' },
    });
  });

  it('omits the revision when it is not configured', async () => {
    expect(await (await call({})).json()).not.toHaveProperty('revision');
    expect(await (await call()).json()).toMatchObject({ status: 'ok', database: 'ok' });
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
    });
    const response = await call({});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', worker: { status: 'stale' } });
  });
});
