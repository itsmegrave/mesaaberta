import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { apiOver } from '../db/test-api';
import { createHandleAuth } from './handle-auth';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' };

const setup = (platformEnv: object | undefined, getUser = vi.fn()) => {
  const createClient = vi.fn(() => ({ auth: { getUser } }));
  const event = {
    locals: { env: platformEnv },
    cookies: { getAll: () => [], set: vi.fn() },
  } as unknown as RequestEvent;
  const run = () =>
    createHandleAuth(createClient as never)({ event, resolve: async () => new Response() });

  return { createClient, event, run, getUser };
};

describe('handleAuth', () => {
  it('leaves auth off when Supabase is not configured: no client, and nobody is signed in', async () => {
    const { createClient, event, run } = setup({});
    await run();

    expect(createClient).not.toHaveBeenCalled();
    expect(event.locals.supabase).toBeNull();
    expect(await event.locals.getUser()).toBeNull();
  });

  it('needs both the URL and the key', async () => {
    const { event, run } = setup({ SUPABASE_URL: env.SUPABASE_URL });
    await run();

    expect(event.locals.supabase).toBeNull();
  });

  it('keeps the session cookies away from page scripts, whatever @supabase/ssr asks', async () => {
    let setAll: ((cookies: object[]) => void) | undefined;
    const createClient = vi.fn((_url: string, _key: string, options: never) => {
      setAll = (options as { cookies: { setAll: typeof setAll } }).cookies.setAll;
      return { auth: { getUser: vi.fn() } };
    });
    const set = vi.fn();
    const event = {
      locals: { env },
      cookies: { getAll: () => [], set },
    } as unknown as RequestEvent;
    await createHandleAuth(createClient as never)({ event, resolve: async () => new Response() });

    setAll?.([
      {
        name: 'sb-x-auth-token',
        value: 'base64-token',
        options: { httpOnly: false, sameSite: 'lax', maxAge: 60, path: '/auth' },
      },
    ]);

    expect(set).toHaveBeenCalledWith('sb-x-auth-token', 'base64-token', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60,
      path: '/',
    });
  });

  it('returns the user Supabase verified, and records the id for the request log', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const { event, run } = setup(env, getUser);
    await run();

    expect(await event.locals.getUser()).toEqual({ id: 'u1' });
    expect(event.locals.userId).toBe('u1');
  });

  it('asks Supabase once per request however often a route asks who is signed in', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const { event, run } = setup(env, getUser);
    await run();

    await Promise.all([event.locals.getUser(), event.locals.getUser()]);
    await event.locals.getUser();

    expect(getUser).toHaveBeenCalledOnce();
  });

  it.each([
    ['no session', { data: { user: null }, error: { message: 'Auth session missing!' } }],
    ['a rejected token', { data: { user: null }, error: { message: 'invalid JWT' } }],
  ])('treats %s as anonymous', async (_name, answer) => {
    const { event, run } = setup(env, vi.fn().mockResolvedValue(answer));
    await run();

    expect(await event.locals.getUser()).toBeNull();
    expect(event.locals.userId).toBeUndefined();
  });

  it('never trusts an unverified answer: a user that comes with an error is anonymous', async () => {
    const { event, run } = setup(
      env,
      vi.fn().mockResolvedValue({ data: { user: { id: 'forged' } }, error: { message: 'bad' } }),
    );
    await run();

    expect(await event.locals.getUser()).toBeNull();
  });
});

describe('getProfile', () => {
  const id = '00000000-0000-4000-8000-000000000301';
  const signedIn = () => vi.fn().mockResolvedValue({ data: { user: { id } }, error: null });
  // The api Worker reads the profile over the test database.
  const withApi = (db: unknown) => ({ ...env, ...apiOver(db as never) });

  it("returns the signed-in user's profile from the api: the actor the policy decides about", async () => {
    const test = await createTestDb();
    await test.db.insert(profiles).values({ id, username: 'ana', role: 'admin' });
    const { event, run } = setup(withApi(test.db), signedIn());
    await run();

    const profile = await event.locals.getProfile();
    expect(profile).toMatchObject({ id, role: 'admin', status: 'active' });
    // JSON turned the dates into strings; they come back as dates.
    expect(profile?.createdAt).toBeInstanceOf(Date);
    await test.close();
  });

  it('is null for an anonymous visitor, without asking the api', async () => {
    const api = vi.fn();
    const { event, run } = setup({ API: { fetch: api } });
    await run();

    expect(await event.locals.getProfile()).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it('is null when someone is signed in but has no profile, rather than a made-up actor', async () => {
    const test = await createTestDb();
    const { event, run } = setup(withApi(test.db), signedIn());
    await run();

    expect(await event.locals.getProfile()).toBeNull();
    await test.close();
  });

  it('is null while there is no api to ask', async () => {
    const { event, run } = setup(env, signedIn());
    await run();

    expect(await event.locals.getProfile()).toBeNull();
  });

  it('fails the request when the api cannot answer, instead of reading as no profile', async () => {
    const api = vi.fn(async () => Response.json({ error: 'internal_error' }, { status: 500 }));
    const { event, run } = setup({ ...env, API: { fetch: api } }, signedIn());
    (event.locals as { log?: unknown }).log = { warn: vi.fn() };
    await run();

    await expect(event.locals.getProfile()).rejects.toMatchObject({ status: 503 });
  });

  it('loads once per request however often it is asked', async () => {
    const test = await createTestDb();
    await test.db.insert(profiles).values({ id, username: 'ana' });
    const getUser = signedIn();
    const { event, run } = setup(withApi(test.db), getUser);
    await run();

    const [a, b] = await Promise.all([event.locals.getProfile(), event.locals.getProfile()]);

    expect(a).toBe(b);
    expect(getUser).toHaveBeenCalledOnce();
    await test.close();
  });
});
