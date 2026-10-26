import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { MAX_BODY_BYTES, handleBodyLimit } from './body-limit';

const post = (headers: HeadersInit) =>
  ({
    request: new Request('https://example.test/tables/new', { method: 'POST', headers }),
  }) as RequestEvent;

describe('handleBodyLimit', () => {
  it('refuses a body declared over the limit without running the rest of the app', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const response = await handleBodyLimit({
      event: post({ 'content-length': String(MAX_BODY_BYTES + 1) }),
      resolve,
    });

    expect(response.status).toBe(413);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lets a body at the limit, one with no declared length and a GET through', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    for (const headers of [{ 'content-length': String(MAX_BODY_BYTES) }, {}] as HeadersInit[]) {
      expect((await handleBodyLimit({ event: post(headers), resolve })).status).toBe(200);
    }
    const get = { request: new Request('https://example.test/tables') } as RequestEvent;
    expect((await handleBodyLimit({ event: get, resolve })).status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(3);
  });
});
