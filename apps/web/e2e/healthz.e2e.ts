import { expect, test } from '@playwright/test';

test.describe('/healthz', () => {
  test('answers 200 with a JSON status and the database state and is never cached', async ({
    request,
  }) => {
    const response = await request.get('/healthz');

    expect(response.status()).toBe(200);
    // `ok` with a database, `not_configured` without one, as in CI.
    // `revision` appears only when the deployment pipeline sets DEPLOYMENT_SOURCE_SHA.
    expect(await response.json()).toMatchObject({
      status: 'ok',
      database: expect.stringMatching(/^(ok|not_configured)$/),
    });
    expect(response.headers()['cache-control']).toBe('no-store');
  });
});
