import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handleHttpMetrics, webMetrics } from './http-metrics';

const eventFor = (route: string | null, method = 'GET') =>
  ({ route: { id: route }, request: { method } }) as unknown as RequestEvent;

describe('handleHttpMetrics', () => {
  it('counts a finished request under its route template', async () => {
    await handleHttpMetrics({
      event: eventFor('/counted-route'),
      resolve: async () => new Response('ok', { status: 201 }),
    });

    expect(webMetrics.render()).toContain(
      'service="web",route="/counted-route",method="GET",status="2xx"} 1',
    );
  });

  it('counts a thrown error with the status it carries, and rethrows it', async () => {
    const refusal = Object.assign(new Error('gone'), { status: 404 });

    await expect(
      handleHttpMetrics({
        event: eventFor('/thrown-route'),
        resolve: async () => {
          throw refusal;
        },
      }),
    ).rejects.toBe(refusal);

    expect(webMetrics.render()).toContain('route="/thrown-route",method="GET",status="4xx"} 1');
  });

  it('files a request no route matched under /unmatched', async () => {
    await handleHttpMetrics({
      event: eventFor(null),
      resolve: async () => new Response('missing', { status: 404 }),
    });

    expect(webMetrics.render()).toContain('route="/unmatched"');
  });
});
