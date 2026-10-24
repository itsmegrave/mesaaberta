import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';
import { PASSWORD_RESET_LIMIT } from '@mesaaberta/core/server/auth/attempt-limit';
import { createTestDb } from '#lib/server/db/test-db.js';

const setup = (
  answer: object = { data: {}, error: null },
  supabase = true,
  db: unknown = null,
  env: object = {},
  apiOn = false,
) => {
  const resetPasswordForEmail = vi.fn().mockResolvedValue(answer);
  const setHeaders = vi.fn();
  const locals = {
    db,
    env,
    flags: { isEnabled: vi.fn(async (name: string) => apiOn && name === 'api_auth') },
    supabase: supabase ? { auth: { resetPasswordForEmail } } : null,
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

  return { resetPasswordForEmail, event, setHeaders };
};

const submit = (event: RequestEvent) =>
  (actions as Record<string, (e: RequestEvent) => Promise<unknown>>).default(event);

describe('the forgot-password page', () => {
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

  it('asks Supabase for a link and says "sent"', async () => {
    const { event, resetPasswordForEmail } = setup();

    expect(await submit(event({ email: 'Ana@Example.com' }))).toMatchObject({
      form: { message: { code: 'sent' } },
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
      redirectTo: 'https://mesaaberta.app/auth/callback?next=%2Freset',
    });
  });

  it('gives the very same answer for an address that has no account, since Supabase does not say either', async () => {
    const known = setup();
    const unknown = setup();

    for (const result of [
      await submit(known.event({ email: 'ana@example.com' })),
      await submit(unknown.event({ email: 'nobody@example.com' })),
    ])
      expect(result).toMatchObject({ form: { message: { code: 'sent' } } });
  });

  it('refuses something that is not an email before Supabase is asked', async () => {
    const { event, resetPasswordForEmail } = setup();

    expect(await submit(event({ email: 'nope' }))).toMatchObject({
      status: 400,
      data: { form: { errors: { email: expect.any(Array) } } },
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('says to wait when Supabase is rate limiting, and that it failed on any other error', async () => {
    const limited = setup({
      data: null,
      error: { code: 'over_email_send_rate_limit', status: 429, message: 'x' },
    });
    const broken = setup({ data: null, error: { code: 'boom', status: 500, message: 'x' } });

    expect(await submit(limited.event({ email: 'ana@example.com' }))).toMatchObject({
      status: 429,
      data: { form: { message: { code: 'rate_limited' } } },
    });
    expect(await submit(broken.event({ email: 'ana@example.com' }))).toMatchObject({
      status: 500,
      data: { form: { message: { code: 'failed' } } },
    });
  });

  it('refuses an address past the limit with 429, before Supabase sends any e-mail', async () => {
    const test = await createTestDb();
    try {
      const { event, resetPasswordForEmail, setHeaders } = setup(undefined, true, test.db);
      for (let i = 0; i < PASSWORD_RESET_LIMIT.max; i++) {
        await submit(event({ email: 'ana@example.com' }));
      }
      resetPasswordForEmail.mockClear();

      expect(await submit(event({ email: 'ana@example.com' }))).toMatchObject({
        status: 429,
        data: { form: { message: { code: 'rate_limited' } } },
      });
      expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': expect.any(String) });
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    } finally {
      await test.close();
    }
  });

  it('goes back to the login page, which says so, when there is no Supabase', async () => {
    const { event } = setup({}, false);

    await expect(submit(event({ email: 'ana@example.com' }))).rejects.toMatchObject({
      status: 303,
      location: '/login?error=unavailable',
    });
  });

  describe('behind api_auth', () => {
    const api = (answer: { status: number; body: object } | 'down') => {
      const fetch = vi.fn(async (_request: Request) =>
        answer === 'down'
          ? Promise.reject(new Error('down'))
          : new Response(JSON.stringify(answer.body), { status: answer.status }),
      );
      return { fetch, env: { API: { fetch } } };
    };

    it('lets the api send the link and does not touch Supabase here', async () => {
      const { fetch, env } = api({ status: 200, body: { result: 'sent' } });
      const { event, resetPasswordForEmail } = setup(undefined, true, null, env, true);

      expect(await submit(event({ email: 'Ana@Example.com' }))).toMatchObject({
        form: { message: { code: 'sent' } },
      });
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
      const request = fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe('/v1/auth/password-reset');
      expect(request.headers.get('x-client-ip')).toBe('203.0.113.7');
      expect(request.headers.get('x-actor-id')).toBeNull();
      expect(await request.json()).toEqual({
        email: 'ana@example.com',
        origin: 'https://mesaaberta.app',
      });
    });

    it('shows the wait the api asked for', async () => {
      const { env } = api({ status: 429, body: { result: 'rate_limited', retryAfter: 42 } });
      const { event, setHeaders } = setup(undefined, true, null, env, true);

      expect(await submit(event({ email: 'ana@example.com' }))).toMatchObject({
        status: 429,
        data: { form: { message: { code: 'rate_limited', retryAfter: 42 } } },
      });
      expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '42' });
    });

    it('keeps the web path when the api cannot be reached', async () => {
      const { env } = api('down');
      const { event, resetPasswordForEmail } = setup(undefined, true, null, env, true);

      expect(await submit(event({ email: 'ana@example.com' }))).toMatchObject({
        form: { message: { code: 'sent' } },
      });
      expect(resetPasswordForEmail).toHaveBeenCalledOnce();
    });
  });
});
