import { describe, expect, it } from 'vitest';
import { createApi } from './app';

describe('api app', () => {
  it('answers the health probe', async () => {
    const response = await createApi().request('/healthz');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'api' });
  });

  it('answers an unknown path with JSON, not HTML', async () => {
    const response = await createApi().request('/tables');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('hides the cause of an unexpected failure', async () => {
    const app = createApi();
    app.get('/boom', () => {
      throw new Error('secret detail');
    });

    const response = await app.request('/boom');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'internal_error' });
  });
});
