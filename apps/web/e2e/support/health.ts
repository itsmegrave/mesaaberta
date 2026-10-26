import type { APIRequestContext } from '@playwright/test';

/** Local test-only bearer the e2e servers get as `HEALTHZ_TOKEN` (playwright.config.ts). */
export const healthToken = 'mesaaberta-e2e-health';

/** GET /healthz as the uptime monitor and the deploy gate ask: with the token. */
export const getHealth = (request: APIRequestContext) =>
  request.get('/healthz', { headers: { authorization: `Bearer ${healthToken}` } });
