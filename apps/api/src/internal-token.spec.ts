import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { internalToken } from './internal-token';

const app = (secret: string) => {
  const api = new Hono();
  api.use('*', internalToken(secret));
  api.get('/v1/ping', (c) => c.json({ ok: true }));
  return api;
};

describe('internalToken', () => {
  it('answers 401 without the shared secret or with another one', async () => {
    expect((await app('s3cret').request('/v1/ping')).status).toBe(401);
    const wrong = await app('s3cret').request('/v1/ping', {
      headers: { 'x-internal-token': 'nope' },
    });
    expect(wrong.status).toBe(401);
  });

  it('lets the request through with the secret', async () => {
    const response = await app('s3cret').request('/v1/ping', {
      headers: { 'x-internal-token': 's3cret' },
    });

    expect(response.status).toBe(200);
  });

  it('refuses everything when no secret is configured', async () => {
    const response = await app('').request('/v1/ping', { headers: { 'x-internal-token': '' } });

    expect(response.status).toBe(401);
  });
});
