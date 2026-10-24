import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createHandleRuntime } from './runtime';
import type { HostBindings } from './host/types';
import { host as bunHost } from './host/bun';

const run = async (bindings: Partial<HostBindings>) => {
  const event = { locals: {} } as unknown as RequestEvent;
  await createHandleRuntime({
    name: 'bun',
    env: () => undefined,
    telemetry:
      () =>
      ({ event, resolve }) =>
        resolve(event),
    ...bindings,
  })({ event, resolve: async () => new Response() });
  return event.locals;
};

describe('createHandleRuntime', () => {
  it("exposes the host's variables and bindings as locals.env", async () => {
    const env = { SUPABASE_URL: 'https://x.example' } as unknown as App.Locals['env'];
    expect((await run({ env: () => env })).env).toBe(env);
  });

  it('leaves locals.env undefined when the host provides none', async () => {
    expect((await run({})).env).toBeUndefined();
  });

  it('offers nothing beyond variables when the host has no context or cache', async () => {
    expect((await run({})).host).toEqual({ waitUntil: undefined, cache: undefined });
  });

  it("hands work to the host's waitUntil", async () => {
    const waitUntil = vi.fn();
    const { host } = await run({ waitUntil });
    const work = Promise.resolve();
    host.waitUntil?.(work);
    expect(waitUntil).toHaveBeenCalledWith(work);
  });

  it("reads strings through the host's cache", async () => {
    const stored = new Map<string, string>([['https://x.example/a', 'body']]);
    const cache = {
      get: async (url: string) => stored.get(url),
      set: async (url: string, body: string) => void stored.set(url, body),
    };
    const { host } = await run({ cache: () => cache });

    expect(await host.cache?.get('https://x.example/a')).toBe('body');
  });
});

describe('the Bun host', () => {
  it('reads the process environment and has no shared cache', () => {
    process.env.MESABERTA_HOST_TEST = 'yes';

    expect((bunHost.env() as unknown as Record<string, string>).MESABERTA_HOST_TEST).toBe('yes');
    expect(bunHost.cache).toBeUndefined();
    delete process.env.MESABERTA_HOST_TEST;
  });

  it('lets a promise nobody awaits finish, and swallows its failure', async () => {
    const unhandled = vi.fn();
    process.once('unhandledRejection', unhandled);

    bunHost.waitUntil?.(Promise.reject(new Error('boom')));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
  });

  it('sets no error reporting up around the request', async () => {
    const event = { locals: {} } as unknown as RequestEvent;
    const resolve = vi.fn(async () => new Response('ok'));

    const response = await bunHost.telemetry({})({ event, resolve });

    expect(resolve).toHaveBeenCalledWith(event);
    expect(await response.text()).toBe('ok');
  });
});
