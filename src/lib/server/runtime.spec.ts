import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handleRuntime } from './runtime';

const run = async (platform: object | undefined) => {
  const event = { locals: {}, platform } as unknown as RequestEvent;
  await handleRuntime({ event, resolve: async () => new Response() });
  return event.locals.env;
};

describe('handleRuntime', () => {
  it("exposes the host's variables and bindings as locals.env", async () => {
    const env = { SUPABASE_URL: 'https://x.example' };
    expect(await run({ env })).toBe(env);
  });

  it('leaves locals.env undefined when the host provides none', async () => {
    expect(await run(undefined)).toBeUndefined();
  });
});
