import { describe, expect, it, vi } from 'vitest';
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

  it('logs one line per request with the route template, never the path', async () => {
    const lines: string[] = [];
    const spy = vi
      .spyOn(console, 'info')
      .mockImplementation((line: string) => void lines.push(line));
    const app = createApi();

    await app.request('/v1/nothing/ana@example.com');
    spy.mockRestore();

    const entry = lines.map((line) => JSON.parse(line)).find((l) => l.msg === 'api request');
    expect(entry).toMatchObject({ method: 'GET', status: 404 });
    expect(JSON.stringify(entry)).not.toContain('ana@example.com');
  });
});
