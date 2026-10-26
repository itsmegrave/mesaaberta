import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { signInForSession, signUpForSession, completeLogin } = vi.hoisted(() => ({
  signInForSession: vi.fn(),
  signUpForSession: vi.fn(),
  completeLogin: vi.fn(),
}));
vi.mock('@mesaaberta/core/server/auth/email', () => ({ signInForSession, signUpForSession }));
vi.mock('@mesaaberta/core/server/auth/login', () => ({ completeLogin }));

import { authRoutes } from './auth';

const env = {
  DATABASE_URL: 'postgres://test',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'key',
};
// The api closes the connection it opens; a loopback address skips the limit, so no table is needed.
const open = (() => ({ db: {}, close: vi.fn(async () => {}) })) as never;
const post = (body: unknown, environment: object = env) =>
  authRoutes(open).request(
    '/password-reset',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-ip': '127.0.0.1' },
      body: JSON.stringify(body),
    },
    environment,
  );

describe('api auth routes', () => {
  it('refuses a bad address or an origin that is not an origin', async () => {
    expect((await post({ email: 'nope', origin: 'https://mesaaberta.app' })).status).toBe(400);
    expect((await post({ email: 'a@b.co', origin: 'javascript:alert(1)' })).status).toBe(400);
    expect((await post({ email: 'a@b.co', origin: 'https://x.test/path' })).status).toBe(400);
  });

  it('answers unavailable without the Supabase settings', async () => {
    const response = await post(
      { email: 'a@b.co', origin: 'https://mesaaberta.app' },
      { DATABASE_URL: 'postgres://test' },
    );

    expect(response.status).toBe(503);
  });
});

describe('api sign-in', () => {
  const signIn = (body: unknown, environment: object = env) =>
    authRoutes(open, () => ({}) as SupabaseClient).request(
      '/sign-in',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-client-ip': '127.0.0.1' },
        body: JSON.stringify(body),
      },
      environment,
    );
  const credentials = { email: 'ana@example.com', password: 'correct horse' };

  beforeEach(() => signInForSession.mockReset());

  it('refuses a bad address or an empty password without asking Supabase', async () => {
    expect((await signIn({ email: 'nope', password: 'x' })).status).toBe(400);
    expect((await signIn({ email: 'a@b.co', password: '' })).status).toBe(400);
    expect(signInForSession).not.toHaveBeenCalled();
  });

  it('answers unavailable without the Supabase settings', async () => {
    expect((await signIn(credentials, { DATABASE_URL: 'postgres://test' })).status).toBe(503);
  });

  it('hands back the session Supabase issued, and only then', async () => {
    const session = { accessToken: 'jwt-a', refreshToken: 'jwt-r' };
    signInForSession.mockResolvedValue({ result: 'ok', session });

    const response = await signIn(credentials);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'ok', session });
    expect(signInForSession.mock.calls[0][1]).toMatchObject(credentials);
  });

  it.each([
    ['invalid', 400],
    ['unconfirmed', 400],
    ['suspended', 403],
    ['rate_limited', 429],
    ['failed', 500],
  ])('answers %s with %i and no session', async (result, status) => {
    signInForSession.mockResolvedValue({ result, session: null });

    const response = await signIn(credentials);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ result });
  });
});

describe('api sign-up', () => {
  const signUp = (body: unknown, environment: object = env) =>
    authRoutes(open, () => ({}) as SupabaseClient).request(
      '/sign-up',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-client-ip': '127.0.0.1' },
        body: JSON.stringify(body),
      },
      environment,
    );
  const details = {
    email: 'ana@example.com',
    password: 'correct horse',
    origin: 'https://mesaaberta.app',
  };

  beforeEach(() => signUpForSession.mockReset());

  it('refuses a bad address or an origin that is not an origin', async () => {
    expect((await signUp({ ...details, email: 'nope' })).status).toBe(400);
    expect((await signUp({ ...details, origin: 'javascript:alert(1)' })).status).toBe(400);
    expect(signUpForSession).not.toHaveBeenCalled();
  });

  it('answers unavailable without the Supabase settings', async () => {
    expect((await signUp(details, { DATABASE_URL: 'postgres://test' })).status).toBe(503);
  });

  it('hands back the session only when the person is signed in at once', async () => {
    const session = { accessToken: 'jwt-a', refreshToken: 'jwt-r' };
    signUpForSession.mockResolvedValue({ result: 'signed_in', session });
    expect(await (await signUp(details)).json()).toEqual({ result: 'signed_in', session });

    signUpForSession.mockResolvedValue({ result: 'check_email', session: null });
    expect(await (await signUp(details)).json()).toEqual({ result: 'check_email' });
  });

  it.each([
    ['weak_password', 400],
    ['rate_limited', 429],
    ['failed', 500],
  ])('answers %s with %i', async (result, status) => {
    signUpForSession.mockResolvedValue({ result, session: null });

    const response = await signUp(details);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ result });
  });
});

describe('api new password', () => {
  const fake = (answers: Array<{ status: number; body?: object } | 'down'>) => {
    const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      const next = answers.shift() ?? { status: 200 };
      if (next === 'down') throw new Error('down');
      return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
    });
    return request as unknown as typeof fetch & typeof request;
  };
  const send = (
    request: typeof fetch,
    body: unknown = { password: 'correct horse', passwordConfirm: 'correct horse' },
    headers: Record<string, string> = { authorization: 'Bearer jwt-a' },
    environment: object = env,
  ) =>
    authRoutes(open, undefined, { request }).request(
      '/new-password',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      },
      environment,
    );

  it('sets the password with the person’s own token and signs the other sessions out', async () => {
    const request = fake([{ status: 200 }, { status: 204 }]);

    const response = await send(request);

    expect(await response.json()).toEqual({ result: 'ok' });
    const [put, logout] = request.mock.calls;
    expect(String(put[0])).toBe('https://supabase.test/auth/v1/user');
    expect(put[1]?.method).toBe('PUT');
    expect((put[1]?.headers as Record<string, string>).authorization).toBe('Bearer jwt-a');
    expect(JSON.parse(String(put[1]?.body))).toEqual({ password: 'correct horse' });
    expect(String(logout[0])).toBe('https://supabase.test/auth/v1/logout?scope=others');
  });

  it('refuses without a token, with different passwords, or without the Supabase settings', async () => {
    const request = fake([]);
    expect((await send(request, undefined, {})).status).toBe(401);
    expect(
      (await send(request, { password: 'correct horse', passwordConfirm: 'other horse' })).status,
    ).toBe(400);
    expect((await send(request, undefined, undefined, {})).status).toBe(503);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 422, body: { error_code: 'weak_password' } }, 'weak_password', 400],
    [{ status: 422, body: { error_code: 'same_password' } }, 'same_password', 400],
    [{ status: 401 }, 'no_session', 401],
    [{ status: 429 }, 'rate_limited', 429],
    [{ status: 500 }, 'failed', 500],
    ['down' as const, 'failed', 500],
  ])('answers %j as %s', async (answer, result, status) => {
    const response = await send(fake([answer]));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ result });
  });
});

describe('api finish-login', () => {
  const fake = (answer: { status: number; body?: object } | 'down') =>
    vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      if (answer === 'down') throw new Error('down');
      return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status });
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const send = (
    request: typeof fetch,
    headers: Record<string, string> = { authorization: 'Bearer jwt-a' },
    environment: object = env,
  ) =>
    authRoutes(open, undefined, { request }).request(
      '/finish-login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-client-ip': '203.0.113.9', ...headers },
        body: JSON.stringify({ next: '/tables/new' }),
      },
      environment,
    );
  const user = { status: 200, body: { id: 'user-1', user_metadata: { name: 'Ana' } } };

  beforeEach(() => completeLogin.mockReset());

  it('finishes the sign-in for whoever Supabase says the token belongs to', async () => {
    completeLogin.mockResolvedValue({ result: 'ok', target: '/tables/new' });
    const request = fake(user);

    const response = await send(request);

    expect(await response.json()).toEqual({ result: 'ok', target: '/tables/new' });
    expect(String(request.mock.calls[0][0])).toBe('https://supabase.test/auth/v1/user');
    const [deps, who, next] = completeLogin.mock.calls[0];
    expect(deps.ip).toBe('203.0.113.9');
    expect(who).toEqual({ id: 'user-1', user_metadata: { name: 'Ana' } });
    expect(next).toBe('/tables/new');
  });

  it.each([
    [{ result: 'suspended' }, 403],
    [{ result: 'profile_failed' }, 500],
  ])('answers %j with %i', async (done, status) => {
    completeLogin.mockResolvedValue(done);

    const response = await send(fake(user));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(done);
  });

  it('does nothing without a token, with a token Supabase rejects, or when Supabase is down', async () => {
    expect((await send(fake(user), {})).status).toBe(401);
    expect((await send(fake({ status: 401 }))).status).toBe(401);
    expect((await send(fake('down'))).status).toBe(502);
    expect((await send(fake({ status: 500 }))).status).toBe(502);
    expect((await send(fake(user), undefined, { DATABASE_URL: 'postgres://test' })).status).toBe(
      503,
    );
    expect(completeLogin).not.toHaveBeenCalled();
  });
});
