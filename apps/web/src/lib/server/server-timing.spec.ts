import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { createHandleServerTiming } from './server-timing';

const event = {} as RequestEvent;

describe('handleServerTiming', () => {
  it('names the backend and reports the total time', async () => {
    const response = await createHandleServerTiming('bun')({
      event,
      resolve: async () => new Response('ok'),
    });

    expect(response.headers.get('x-backend')).toBe('bun');
    expect(response.headers.get('server-timing')).toMatch(/^total;dur=\d+\.\d$/);
  });

  it('keeps the status, body and headers, and adds to a timing a route already set', async () => {
    const response = await createHandleServerTiming('cloudflare')({
      event,
      resolve: async () =>
        new Response('gone', {
          status: 404,
          headers: { 'cache-control': 'no-store', 'server-timing': 'db;dur=3' },
        }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('gone');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('server-timing')).toMatch(/^db;dur=3, total;dur=\d+\.\d$/);
  });

  it('adds the database time, in milliseconds, when the request used the database', async () => {
    const response = await createHandleServerTiming('bun')({
      event: { locals: { dbSeconds: 0.0123 } } as unknown as RequestEvent,
      resolve: async () => new Response('ok'),
    });

    expect(response.headers.get('server-timing')).toMatch(/^db;dur=12\.3, total;dur=\d+\.\d$/);
  });
});
