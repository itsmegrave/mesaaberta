import { describe, expect, it, vi } from 'vitest';

const startSpan = vi.fn((_options: unknown, run: () => unknown) => run());
vi.mock('@sentry/sveltekit', () => ({
  startSpan: (options: unknown, run: () => unknown) => startSpan(options, run),
  getTraceData: () => ({
    'sentry-trace': 'abc-def-1',
    baggage: 'sentry-release=v1',
    traceparent: undefined,
  }),
}));

const { callApiRaw } = await import('./api-client');

describe('sendToApi tracing', () => {
  it('wraps each call in a span named by the route template and passes the trace on', async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({}));
    const env = { API: { fetch } } as unknown as App.Locals['env'];

    await callApiRaw(
      env,
      '/v1/tables/minha-mesa?x=1',
      'a',
      { warn: vi.fn() } as never,
      undefined,
      {},
      'GET',
    );

    expect(startSpan).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'http.client', name: 'GET /v1/tables/:param' }),
      expect.any(Function),
    );
    const request = fetch.mock.calls[0][0];
    expect(request.headers.get('sentry-trace')).toBe('abc-def-1');
    expect(request.headers.get('baggage')).toBe('sentry-release=v1');
    expect(request.headers.has('traceparent')).toBe(false);
  });
});
