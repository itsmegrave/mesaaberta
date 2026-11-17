import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mesaaberta/core/server/auth/onboarding', () => ({
  afterSignIn: async () => '/dashboard',
}));

import { actions } from './+page.server';

const setup = (env: object = {}, setSession = vi.fn().mockResolvedValue({ error: null })) => {
  const setHeaders = vi.fn();
  const locals = {
    env,
    supabase: { auth: { setSession } },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
  };
  const event = () => {
    const body = new FormData();
    body.set('email', 'ana@example.com');
    body.set('password', 'correct horse');
    const url = new URL('https://mesaaberta.app/signup');
    return {
      locals,
      url,
      getClientAddress: () => '203.0.113.7',
      setHeaders,
      request: new Request(url, { method: 'POST', body }),
    } as unknown as RequestEvent;
  };
  return { event, locals, setHeaders, setSession };
};

const api = (answer: { status: number; body: object } | 'down') => {
  const fetch = vi.fn(async (_request: Request) =>
    answer === 'down'
      ? Promise.reject(new Error('down'))
      : new Response(JSON.stringify(answer.body), { status: answer.status }),
  );
  return { fetch, env: { API: { fetch } } };
};

const submit = (event: RequestEvent) =>
  (actions as Record<string, (e: RequestEvent) => Promise<unknown>>).default(event);

describe('signing up with e-mail', () => {
  describe('through the api', () => {
    it('sets the session the api issued', async () => {
      const { fetch, env } = api({
        status: 200,
        body: { result: 'signed_in', session: { accessToken: 'jwt-a', refreshToken: 'jwt-r' } },
      });
      const { event, setSession, locals } = setup(env);

      await expect(submit(event())).rejects.toMatchObject({ status: 303, location: '/dashboard' });
      expect(setSession).toHaveBeenCalledWith({ access_token: 'jwt-a', refresh_token: 'jwt-r' });
      const request = fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe('/v1/auth/sign-up');
      expect(request.headers.get('x-client-ip')).toBe('203.0.113.7');
      expect(await request.json()).toMatchObject({
        email: 'ana@example.com',
        origin: 'https://mesaaberta.app',
      });
      expect(JSON.stringify(locals.log.warn.mock.calls)).not.toMatch(/jwt-|correct horse/);
    });

    it('asks the person to check the e-mail when the api sent no session', async () => {
      const { env } = api({ status: 200, body: { result: 'check_email' } });
      const { event, setSession } = setup(env);

      expect(await submit(event())).toMatchObject({ form: { message: { code: 'check_email' } } });
      expect(setSession).not.toHaveBeenCalled();
    });

    it('shows the refusal the api gave', async () => {
      const { env } = api({ status: 400, body: { result: 'weak_password' } });
      const { event } = setup(env);

      expect(await submit(event())).toMatchObject({
        status: 400,
        data: { form: { message: { code: 'weak_password' } } },
      });
    });

    it('shows the wait the api asked for', async () => {
      const { env } = api({ status: 429, body: { result: 'rate_limited', retryAfter: 42 } });
      const { event, setHeaders } = setup(env);

      expect(await submit(event())).toMatchObject({
        status: 429,
        data: { form: { message: { code: 'rate_limited', retryAfter: 42 } } },
      });
      expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '42' });
    });

    it('says it failed when the api cannot be reached', async () => {
      const { env } = api('down');
      const { event } = setup(env);

      expect(await submit(event())).toMatchObject({
        status: 500,
        data: { form: { message: { code: 'failed' } } },
      });
    });

    it('sends the person to sign in when the session is not accepted, never signing up twice', async () => {
      const { env } = api({
        status: 200,
        body: { result: 'signed_in', session: { accessToken: 'a', refreshToken: 'r' } },
      });
      const { event } = setup(env, vi.fn().mockResolvedValue({ error: new Error('bad') }));

      await expect(submit(event())).rejects.toMatchObject({
        status: 303,
        location: expect.stringMatching(/^\/login/),
      });
    });
  });
});
