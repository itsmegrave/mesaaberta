import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { handleRequestLog } from './request-log';
import { error, redirect } from '@sveltejs/kit';

const setup = () => {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({ write: (_level, line) => lines.push(JSON.parse(line)) });
  const handle = handleRequestLog(logger);

  const run = async (url: string, headers: Record<string, string> = {}, status = 200) => {
    const event = {
      request: new Request(url, { method: 'POST', headers }),
      url: new URL(url),
      route: { id: new URL(url).pathname },
      locals: {},
    } as unknown as RequestEvent;

    await handle({ event, resolve: async () => new Response(null, { status }) });

    return event;
  };

  return { lines, run, handle };
};

describe('handleRequestLog', () => {
  it.each([303, 403, 404, 503])(
    'preserves expected HTTP status %s without a false 500',
    async (status) => {
      const { lines, handle } = setup();
      const event = {
        request: new Request('https://mesaaberta.test/admin'),
        route: { id: '/admin' },
        locals: {},
      } as unknown as RequestEvent;
      await expect(
        handle({
          event,
          resolve: async () => {
            if (status === 303) redirect(303, '/login?token=private');
            error(status, 'private details');
          },
        }),
      ).rejects.toMatchObject({ status });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        status,
        level: status >= 500 ? 'error' : status === 403 ? 'warn' : 'info',
        event: 'request.completed',
      });
      expect(JSON.stringify(lines)).not.toMatch(/private|token/);
    },
  );
  it('uses the Cloudflare ray id as the request id', async () => {
    const { lines, run } = setup();

    await run('https://mesaaberta.test/', { 'cf-ray': '8f3a1c2b4d5e6f70-GRU' });

    expect(lines[0]).toMatchObject({ requestId: '8f3a1c2b4d5e6f70-GRU' });
  });

  it('makes up a request id when there is no cf-ray header, as in local dev', async () => {
    const { lines, run } = setup();

    await run('https://mesaaberta.test/');
    await run('https://mesaaberta.test/');

    expect(lines[0].requestId).toEqual(expect.any(String));
    expect(lines[0].requestId).not.toBe(lines[1].requestId);
  });

  it('gives routes a logger that carries the same request id', async () => {
    const { lines, run } = setup();

    const event = await run('https://mesaaberta.test/', { 'cf-ray': '0123456789abcdef-GRU' });
    event.locals.log.info('from a route');

    expect(lines.at(-1)).toMatchObject({ msg: 'from a route', requestId: '0123456789abcdef-GRU' });
  });

  it('logs method, path, status and duration once per request', async () => {
    const { lines, run } = setup();

    await run('https://mesaaberta.test/healthz', {}, 204);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      msg: 'request',
      method: 'POST',
      route: '/healthz',
      status: 204,
      durationMs: expect.any(Number),
    });
  });

  it('keeps user identity out of telemetry after a later hook signs someone in', async () => {
    const { lines, handle } = setup();
    const event = {
      request: new Request('https://mesaaberta.test/'),
      url: new URL('https://mesaaberta.test/'),
      locals: {},
    } as unknown as RequestEvent;

    await handle({
      event,
      resolve: async () => {
        event.locals.userId = 'user-1';
        return new Response();
      },
    });

    expect(lines[0]).not.toHaveProperty('userId');
  });

  it('never logs the query string, which can carry tokens', async () => {
    const { lines, run } = setup();

    await run('https://mesaaberta.test/login?token=s3cret&email=ana@example.com');

    expect(JSON.stringify(lines)).not.toMatch(/s3cret|ana@example/);
    expect(lines[0].route).toBe('/login');
  });
});
