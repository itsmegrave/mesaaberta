import { describe, expect, it, vi } from 'vitest';
import { authRoutes } from './auth';

const env = {
  DATABASE_URL: 'postgres://test',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'key',
};
// The api closes the connection it opens; a loopback address skips the limit, so no table is needed.
const open = (() => ({ db: {}, close: vi.fn(async () => {}) })) as never;
const post = (body: unknown, environment: object = env) =>
  authRoutes(open).request(
    '/password-reset',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-ip': '127.0.0.1' },
      body: JSON.stringify(body),
    },
    environment,
  );

describe('api auth routes', () => {
  it('refuses a bad address or an origin that is not an origin', async () => {
    expect((await post({ email: 'nope', origin: 'https://mesaaberta.app' })).status).toBe(400);
    expect((await post({ email: 'a@b.co', origin: 'javascript:alert(1)' })).status).toBe(400);
    expect((await post({ email: 'a@b.co', origin: 'https://x.test/path' })).status).toBe(400);
  });

  it('answers unavailable without the Supabase settings', async () => {
    const response = await post(
      { email: 'a@b.co', origin: 'https://mesaaberta.app' },
      { DATABASE_URL: 'postgres://test' },
    );

    expect(response.status).toBe(503);
  });
});
