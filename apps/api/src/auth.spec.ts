import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { signInForSession, signUpForSession } = vi.hoisted(() => ({
  signInForSession: vi.fn(),
  signUpForSession: vi.fn(),
}));
vi.mock('@mesaaberta/core/server/auth/email', () => ({ signInForSession, signUpForSession }));

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
