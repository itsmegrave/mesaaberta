import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handleRuntime } from './runtime';

const run = async (platform: object | undefined) => {
  const event = { locals: {}, platform } as unknown as RequestEvent;
  await handleRuntime({ event, resolve: async () => new Response() });
  return event.locals;
};

describe('handleRuntime', () => {
  it("exposes the host's variables and bindings as locals.env", async () => {
    const env = { SUPABASE_URL: 'https://x.example' };
    expect((await run({ env })).env).toBe(env);
  });

  it('leaves locals.env undefined when the host provides none', async () => {
    expect((await run(undefined)).env).toBeUndefined();
  });

  it('offers nothing beyond variables when the host has no context or cache', async () => {
    expect((await run(undefined)).host).toEqual({ waitUntil: undefined, cache: undefined });
  });

  it("hands work to the host's waitUntil", async () => {
    const waitUntil = vi.fn();
    const { host } = await run({ ctx: { waitUntil } });
    const work = Promise.resolve();
    host.waitUntil?.(work);
    expect(waitUntil).toHaveBeenCalledWith(work);
  });

  it("stores and reads strings through the host's cache", async () => {
    const stored = new Map<string, Response>();
    const cache = {
      match: async (url: string) => stored.get(url)?.clone(),
      put: async (url: string, response: Response) => void stored.set(url, response),
    };
    const { host } = await run({ caches: { default: cache } });

    expect(await host.cache?.get('https://x.example/a')).toBeUndefined();
    await host.cache?.set('https://x.example/a', 'body', 60);
    expect(await host.cache?.get('https://x.example/a')).toBe('body');
    expect(stored.get('https://x.example/a')?.headers.get('cache-control')).toBe('max-age=60');
  });
});
