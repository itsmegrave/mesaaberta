import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock('@mesaaberta/core/server/auth/password', () => ({ changePassword }));

import { actions } from './+page.server';

const setup = (env: object = {}, apiOn = false, token: string | null = 'jwt-a') => {
  const locals = {
    env,
    flags: { isEnabled: vi.fn(async (name: string) => apiOn && name === 'api_auth_new_password') },
    getUser: async () => ({ id: 'user-1' }),
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: token ? { access_token: token } : null } }),
      },
    },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
  };
  const event = () => {
    const body = new FormData();
    body.set('password', 'correct horse');
    body.set('passwordConfirm', 'correct horse');
    const url = new URL('https://mesaaberta.app/reset');
    return {
      locals,
      url,
      request: new Request(url, { method: 'POST', body }),
    } as unknown as RequestEvent;
  };
  return { event, locals };
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

describe('choosing a new password', () => {
  beforeEach(() => changePassword.mockReset().mockResolvedValue('ok'));

  it('changes it here when the flag is off, and never calls the api', async () => {
    const { fetch, env } = api({ status: 200, body: {} });
    const { event } = setup(env, false);

    await expect(submit(event())).rejects.toMatchObject({ location: '/reset?done=1' });
    expect(fetch).not.toHaveBeenCalled();
    expect(changePassword).toHaveBeenCalledOnce();
  });

  describe('behind api_auth_new_password', () => {
    it('lets the api change it with the person’s own token', async () => {
      const { fetch, env } = api({ status: 200, body: { result: 'ok' } });
      const { event, locals } = setup(env, true);

      await expect(submit(event())).rejects.toMatchObject({ location: '/reset?done=1' });
      expect(changePassword).not.toHaveBeenCalled();
      expect(locals.flags.isEnabled).toHaveBeenCalledWith('api_auth_new_password', {
        id: 'user-1',
      });
      const request = fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe('/v1/auth/new-password');
      expect(request.headers.get('authorization')).toBe('Bearer jwt-a');
      expect(await request.json()).toEqual({
        password: 'correct horse',
        passwordConfirm: 'correct horse',
      });
      expect(JSON.stringify(locals.log.warn.mock.calls)).not.toMatch(/jwt-a|correct horse/);
    });

    it('shows the refusal the api gave, without changing it here', async () => {
      const { env } = api({ status: 400, body: { result: 'weak_password' } });
      const { event } = setup(env, true);

      expect(await submit(event())).toMatchObject({
        status: 400,
        data: { form: { message: { code: 'weak_password' } } },
      });
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('sends the person back to ask for a link when the api says there is no session', async () => {
      const { env } = api({ status: 401, body: { result: 'no_session' } });
      const { event } = setup(env, true);

      await expect(submit(event())).rejects.toMatchObject({ location: '/forgot?error=link' });
    });

    it('changes it here when the api cannot be reached or has no token to use', async () => {
      const down = setup(api('down').env, true);
      await expect(submit(down.event())).rejects.toMatchObject({ location: '/reset?done=1' });

      const noToken = setup(api({ status: 200, body: { result: 'ok' } }).env, true, null);
      await expect(submit(noToken.event())).rejects.toMatchObject({ location: '/reset?done=1' });
      expect(changePassword).toHaveBeenCalledTimes(2);
    });
  });
});
