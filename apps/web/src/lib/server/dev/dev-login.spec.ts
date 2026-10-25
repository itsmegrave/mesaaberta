import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handleDevLogin } from './dev-login';
import { PERSONA_PASSWORD, personas } from './personas';

const local = { DEV_LOGIN: 'true', SUPABASE_URL: 'http://127.0.0.1:54341' };

function setup({
  url = 'http://localhost:5173/dev/login?as=gm&next=/m',
  method = 'GET',
  env = local as Record<string, string> | null,
  supabase = true,
  signInError = null as Error | null,
  username = 'mestre-de-testes' as string | null,
} = {}) {
  const auth = {
    signInWithPassword: vi.fn(async () => ({ error: signInError })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const event = {
    url: new URL(url),
    request: new Request(url, { method }),
    locals: {
      env: env ?? undefined,
      supabase: supabase ? { auth } : null,
      log: { warn: vi.fn() },
      getProfile: vi.fn(async () => ({ username })),
    },
  } as unknown as RequestEvent;
  const resolve = vi.fn(async () => new Response('page'));

  return { auth, event, resolve, run: () => handleDevLogin({ event, resolve }) };
}

describe('handleDevLogin', () => {
  it('signs in as the persona with the real Supabase login and redirects to next', async () => {
    const { run, auth } = setup();

    await expect(run()).rejects.toMatchObject({ status: 303, location: '/m' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: personas.gm.email,
      password: PERSONA_PASSWORD,
    });
  });

  // Each gate on its own: a bug in one must not open the others.
  it.each([
    ['DEV_LOGIN is unset', { env: { SUPABASE_URL: local.SUPABASE_URL } }],
    ['DEV_LOGIN is not exactly true', { env: { ...local, DEV_LOGIN: '1' } }],
    ['there is no env', { env: null }],
    ['the request is for a public host', { url: 'https://mesaaberta.app/dev/login?as=admin' }],
    [
      'Supabase is the hosted project',
      { env: { ...local, SUPABASE_URL: 'https://x.supabase.co' } },
    ],
    ['SUPABASE_URL is not a URL', { env: { ...local, SUPABASE_URL: 'localhost' } }],
    ['auth is off', { supabase: false }],
    ['the persona is unknown', { url: 'http://localhost:5173/dev/login?as=root' }],
    ['the persona is an inherited key', { url: 'http://localhost:5173/dev/login?as=toString' }],
    ['the method is POST', { method: 'POST' }],
  ])('answers 404 when %s', async (_, options) => {
    const { run, auth, resolve } = setup(options);

    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('sends someone without a username to the onboarding step first', async () => {
    const { run } = setup({
      url: 'http://localhost:5173/dev/login?as=new&next=/m',
      username: null,
    });

    await expect(run()).rejects.toMatchObject({
      status: 303,
      location: expect.stringMatching(/\?next=%2Fm$/),
    });
  });

  it('never redirects off the site', async () => {
    const { run } = setup({
      url: 'http://localhost:5173/dev/login?as=gm&next=https://evil.test',
    });

    await expect(run()).rejects.toMatchObject({ status: 303, location: '/' });
  });

  it('says how to fix it when the personas are not seeded', async () => {
    const { run } = setup({ signInError: new Error('Invalid login credentials') });

    await expect(run()).rejects.toMatchObject({ status: 503 });
  });

  it('signs out at /dev/logout', async () => {
    const { run, auth } = setup({ url: 'http://localhost:5173/dev/logout' });

    await expect(run()).rejects.toMatchObject({ status: 303, location: '/' });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('leaves every other path alone', async () => {
    const { run, resolve } = setup({ url: 'http://localhost:5173/dev/loginx', env: null });

    expect(await (await run()).text()).toBe('page');
    expect(resolve).toHaveBeenCalled();
  });
});
