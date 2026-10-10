import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db/health', () => ({ checkDatabase: vi.fn(async () => 'ok') }));

import { checkDatabase } from '$lib/server/db/health';
import { GET } from './+server';

const call = (env?: Record<string, string>) =>
  GET({ locals: { db: {}, log: {} }, platform: env ? { env } : undefined } as never);

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
    });
  });

  it('omits the revision when it is not configured', async () => {
    expect(await (await call({})).json()).toEqual({ status: 'ok', database: 'ok' });
    expect(await (await call()).json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('keeps answering 503 with the revision when the database is down', async () => {
    vi.mocked(checkDatabase).mockResolvedValueOnce('down');
    const response = await call({ DEPLOYMENT_SOURCE_SHA: 'abc' });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'error', revision: 'abc' });
  });
});
