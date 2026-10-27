import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

const { finishLogin } = vi.hoisted(() => ({ finishLogin: vi.fn() }));
vi.mock('@mesaaberta/core/server/auth/login', () => ({ finishLogin }));

const call = async (query: string, locals: object = { supabase: {}, db: null, log: {} }) => {
  const event = {
    url: new URL(`https://mesaaberta.test/auth/callback?${query}`),
    locals,
    getClientAddress: () => '127.0.0.1',
  };
  try {
    await GET(event as never);
  } catch (thrown) {
    return thrown as { status: number; location: string };
  }
  throw new Error('no redirect');
};

describe('the auth callback', () => {
  beforeEach(() => finishLogin.mockReset().mockResolvedValue('/'));

  it('takes someone who was connecting an account back to their profile, saying why it failed', async () => {
    const next = encodeURIComponent('/u/profile/edit/account?conta=conectada');

    expect(
      await call(`error=server_error&error_code=identity_already_exists&next=${next}`),
    ).toMatchObject({
      status: 303,
      location: '/u/profile/edit/account?conta=de_outra_pessoa',
    });
    expect(await call(`error=access_denied&next=${next}`)).toMatchObject({
      location: '/u/profile/edit/account?conta=falhou',
    });
  });

  it('leaves a refused sign-in to the login flow', async () => {
    expect(await call('error=access_denied')).toMatchObject({ location: '/' });
  });

  describe('through the api', () => {
    const remoteOf = async (answer: object | 'down') => {
      const fetch = vi.fn(async (_request: Request) =>
        answer === 'down'
          ? Promise.reject(new Error('down'))
          : new Response(JSON.stringify(answer), { status: 200 }),
      );
      const locals = {
        supabase: {},
        db: null,
        env: { API: { fetch } },
        log: { warn: vi.fn() },
      };
      await call('code=abc&next=%2Ftables%2Fnew', locals);
      const { remote } = finishLogin.mock.calls[0][0] as {
        remote: (token: string, next: string | null) => Promise<unknown>;
      };
      return { fetch, locals, answer: await remote('jwt-a', '/tables/new') };
    };

    it('hands the database half to the api with the new access token', async () => {
      const { fetch, answer, locals } = await remoteOf({
        result: 'ok',
        target: '/tables/new',
      });

      expect(answer).toEqual({ result: 'ok', target: '/tables/new' });
      const request = fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe('/v1/auth/finish-login');
      expect(request.headers.get('authorization')).toBe('Bearer jwt-a');
      expect(request.headers.get('x-client-ip')).toBe('127.0.0.1');
      expect(await request.json()).toEqual({ next: '/tables/new' });
      expect(JSON.stringify(locals.log.warn.mock.calls)).not.toContain('jwt-a');
    });

    it('passes a refusal on so the person is signed out', async () => {
      expect((await remoteOf({ result: 'suspended' })).answer).toEqual({
        result: 'suspended',
      });
    });

    it('never does the database half here: no database, and null when the api is down or answers something else', async () => {
      expect((await remoteOf('down')).answer).toBeNull();
      // Even with a database at hand, the web Worker does not pass it on.
      await call('code=abc', { supabase: {}, db: {}, log: {} });
      expect(finishLogin.mock.calls.at(-1)![0]).toMatchObject({ db: null });
      expect((await remoteOf({ result: 'no_session' })).answer).toBeNull();
    });
  });
});
