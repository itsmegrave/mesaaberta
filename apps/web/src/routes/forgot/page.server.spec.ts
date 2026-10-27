import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

const api = (answer: { status: number; body: object } | 'down') => {
  const fetch = vi.fn(async (_request: Request) =>
    answer === 'down'
      ? Promise.reject(new Error('down'))
      : new Response(JSON.stringify(answer.body), { status: answer.status }),
  );
  return { fetch, env: { API: { fetch } } };
};

const setup = (env: object = api({ status: 200, body: { result: 'sent' } }).env) => {
  const setHeaders = vi.fn();
  const setItem = vi.fn();
  const locals = {
    env,
    supabase: { auth: { storage: { setItem }, storageKey: 'sb-x-auth-token' } },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
  };
  const event = (fields: Record<string, string> = {}) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const url = new URL('https://mesaaberta.app/forgot');
    return {
      locals,
      url,
      getClientAddress: () => '203.0.113.7',
      setHeaders,
      request: new Request(url, { method: 'POST', body }),
    } as unknown as RequestEvent;
  };
  return { event, setHeaders, setItem };
};

const submit = (event: RequestEvent) =>
  (actions as Record<string, (e: RequestEvent) => Promise<unknown>>).default(event);

describe('the forgot-password page', () => {
  it('keeps the verifier the api made, so the e-mailed link can sign the person in', async () => {
    const { env } = api({ status: 200, body: { result: 'sent', codeVerifier: '"v/recovery"' } });
    const { event, setItem } = setup(env);

    await submit(event({ email: 'ana@example.com' }));
    expect(setItem).toHaveBeenCalledWith('sb-x-auth-token-code-verifier', '"v/recovery"');
  });

  it('says a link expired only when it is sent here for that reason, and shows no text from the address', async () => {
    const url = (search: string) =>
      ({ url: new URL(`https://x.test/forgot${search}`) }) as unknown as RequestEvent;

    expect(await (load as (e: RequestEvent) => Promise<unknown>)(url(''))).toEqual({
      linkExpired: false,
      form: expect.any(Object),
    });
    expect(
      await (load as (e: RequestEvent) => Promise<unknown>)(url('?error=<script>')),
    ).toMatchObject({
      linkExpired: true,
    });
  });

  it('lets the api send the link, from the visitor’s network and as nobody', async () => {
    const { fetch, env } = api({ status: 200, body: { result: 'sent' } });
    const { event } = setup(env);

    expect(await submit(event({ email: 'Ana@Example.com' }))).toMatchObject({
      form: { message: { code: 'sent' } },
    });
    const request = fetch.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe('/v1/auth/password-reset');
    expect(request.headers.get('x-client-ip')).toBe('203.0.113.7');
    expect(request.headers.get('x-actor-id')).toBeNull();
    expect(await request.json()).toEqual({
      email: 'ana@example.com',
      origin: 'https://mesaaberta.app',
    });
  });

  it('refuses something that is not an email before the api is asked', async () => {
    const { fetch, env } = api({ status: 200, body: { result: 'sent' } });
    const { event } = setup(env);

    expect(await submit(event({ email: 'nope' }))).toMatchObject({
      status: 400,
      data: { form: { errors: { email: expect.any(Array) } } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the wait the api asked for', async () => {
    const { env } = api({ status: 429, body: { result: 'rate_limited', retryAfter: 42 } });
    const { event, setHeaders } = setup(env);

    expect(await submit(event({ email: 'ana@example.com' }))).toMatchObject({
      status: 429,
      data: { form: { message: { code: 'rate_limited', retryAfter: 42 } } },
    });
    expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '42' });
  });

  it('says it failed when the api failed or cannot be reached', async () => {
    for (const env of [api({ status: 500, body: { result: 'failed' } }).env, api('down').env]) {
      const { event } = setup(env);
      expect(await submit(event({ email: 'ana@example.com' }))).toMatchObject({
        status: 500,
        data: { form: { message: { code: 'failed' } } },
      });
    }
  });
});
