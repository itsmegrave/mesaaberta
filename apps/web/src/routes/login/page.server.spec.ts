import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithEmail } = vi.hoisted(() => ({ signInWithEmail: vi.fn() }));
vi.mock('@mesaaberta/core/server/auth/email', () => ({ signInWithEmail }));
vi.mock('@mesaaberta/core/server/auth/onboarding', () => ({
  afterSignIn: async () => '/dashboard',
}));
vi.mock('@mesaaberta/core/server/auth/attempt-limit', async (original) => ({
  ...(await original<object>()),
  attemptWait: async () => null,
}));

import { actions } from './+page.server';

const setup = (
  env: object = {},
  apiOn = false,
  setSession = vi.fn().mockResolvedValue({ error: null }),
) => {
  const setHeaders = vi.fn();
  const locals = {
    db: {},
    env,
    flags: { isEnabled: vi.fn(async (name: string) => apiOn && name === 'api_auth_sign_in') },
    supabase: { auth: { setSession } },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
  };
  const event = () => {
    const body = new FormData();
    body.set('email', 'ana@example.com');
    body.set('password', 'correct horse');
    const url = new URL('https://mesaaberta.app/login');
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
  (actions as Record<string, (e: RequestEvent) => Promise<unknown>>).email(event);

describe('signing in with e-mail', () => {
  beforeEach(() => signInWithEmail.mockReset().mockResolvedValue('ok'));

  it('signs in here when the flag is off, and never calls the api', async () => {
    const { fetch, env } = api({ status: 200, body: {} });
    const { event } = setup(env, false);

    await expect(submit(event())).rejects.toMatchObject({ status: 303, location: '/dashboard' });
    expect(fetch).not.toHaveBeenCalled();
    expect(signInWithEmail).toHaveBeenCalledOnce();
  });

  describe('behind api_auth_sign_in', () => {
    it('sets the session the api issued and does not sign in here', async () => {
      const { fetch, env } = api({
        status: 200,
        body: { result: 'ok', session: { accessToken: 'jwt-a', refreshToken: 'jwt-r' } },
      });
      const { event, setSession, locals } = setup(env, true);

      await expect(submit(event())).rejects.toMatchObject({ status: 303, location: '/dashboard' });
      expect(setSession).toHaveBeenCalledWith({ access_token: 'jwt-a', refresh_token: 'jwt-r' });
      expect(signInWithEmail).not.toHaveBeenCalled();
      // The flag is targeted by a hash of the network, never the address.
      expect(locals.flags.isEnabled).toHaveBeenCalledWith('api_auth_sign_in', {
        id: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      const request = fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe('/v1/auth/sign-in');
      expect(request.headers.get('x-client-ip')).toBe('203.0.113.7');
      expect(await request.json()).toEqual({ email: 'ana@example.com', password: 'correct horse' });
      // Neither the tokens nor the password reach a log line.
      expect(JSON.stringify(locals.log.warn.mock.calls)).not.toMatch(/jwt-|correct horse/);
    });

    it('shows the refusal the api gave', async () => {
      const { env } = api({ status: 400, body: { result: 'invalid' } });
      const { event, setSession } = setup(env, true);

      expect(await submit(event())).toMatchObject({
        status: 400,
        data: { form: { message: { code: 'invalid' } } },
      });
      expect(setSession).not.toHaveBeenCalled();
      expect(signInWithEmail).not.toHaveBeenCalled();
    });

    it('shows the wait the api asked for', async () => {
      const { env } = api({ status: 429, body: { result: 'rate_limited', retryAfter: 42 } });
      const { event, setHeaders } = setup(env, true);

      expect(await submit(event())).toMatchObject({
        status: 429,
        data: { form: { message: { code: 'rate_limited', retryAfter: 42 } } },
      });
      expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '42' });
    });

    it('signs in here when the api cannot be reached', async () => {
      const { env } = api('down');
      const { event } = setup(env, true);

      await expect(submit(event())).rejects.toMatchObject({ location: '/dashboard' });
      expect(signInWithEmail).toHaveBeenCalledOnce();
    });

    it('signs in here when the session the api issued is not accepted', async () => {
      const { env } = api({
        status: 200,
        body: { result: 'ok', session: { accessToken: 'a', refreshToken: 'r' } },
      });
      const { event } = setup(env, true, vi.fn().mockResolvedValue({ error: new Error('bad') }));

      await expect(submit(event())).rejects.toMatchObject({ location: '/dashboard' });
      expect(signInWithEmail).toHaveBeenCalledOnce();
    });
  });
});
