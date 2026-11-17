import { expect, test } from '@playwright/test';
import { getHealth } from './support/health';

test.describe('/healthz', () => {
  test('answers 200 with a JSON status and the database state and is never cached', async ({
    request,
  }) => {
    const response = await getHealth(request);

    expect(response.status()).toBe(200);
    // `ok` with a database, `not_configured` without one, as in CI.
    // `revision` appears only when the deployment pipeline sets DEPLOYMENT_SOURCE_SHA.
    expect(await response.json()).toMatchObject({
      status: 'ok',
      database: expect.stringMatching(/^(ok|not_configured)$/),
    });
    expect(response.headers()['cache-control']).toBe('no-store');
  });

  test('answers 401 to anyone without the token', async ({ request }) => {
    for (const headers of [{}, { authorization: 'Bearer wrong' }] as Record<string, string>[]) {
      const response = await request.get('/healthz', { headers });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    }
  });
});
