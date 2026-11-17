import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mesaaberta/core/server/auth/onboarding', () => ({
  afterSignIn: async () => '/dashboard',
}));

import { actions } from './+page.server';

const credential = JSON.stringify({ id: 'c', rawId: 'c', type: 'public-key', response: {} });

const setup = ({
  on = true,
  passkey = {},
  apiAnswer = { result: 'ok', target: '/tables' },
}: {
  on?: boolean;
  passkey?: Record<string, unknown>;
  apiAnswer?: object;
} = {}) => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(apiAnswer), { status: 200 }));
  const signOut = vi.fn().mockResolvedValue({});
  const locals = {
    env: { API: { fetch } },
    supabase: { auth: { passkey, signOut } },
    flags: { isEnabled: vi.fn(async (name: string) => name === 'use_passkeys' && on) },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
  };
  const event = (fields: Record<string, string> = {}) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const url = new URL('https://mesaaberta.app/login');
    return {
      locals,
      url,
      getClientAddress: () => '203.0.113.7',
      setHeaders: vi.fn(),
      request: new Request(url, { method: 'POST', body }),
    } as unknown as RequestEvent;
  };
  return { event, locals, fetch, signOut };
};

const run = (name: 'passkeyOptions' | 'passkey', event: RequestEvent) =>
  (actions as Record<string, (e: RequestEvent) => Promise<unknown>>)[name](event);

describe('Entrar com passkey', () => {
  it('hands out a challenge, passing the Turnstile token on', async () => {
    const startAuthentication = vi.fn().mockResolvedValue({
      data: { challenge_id: 'ch-1', options: { challenge: 'abc' } },
      error: null,
    });
    const { event } = setup({ passkey: { startAuthentication } });

    expect(await run('passkeyOptions', event({ captchaToken: 'tok' }))).toEqual({
      challenge: { challengeId: 'ch-1', options: { challenge: 'abc' } },
    });
    expect(startAuthentication).toHaveBeenCalledWith({ options: { captchaToken: 'tok' } });
  });

  it('refuses while use_passkeys is off', async () => {
    const startAuthentication = vi.fn();
    const { event } = setup({ on: false, passkey: { startAuthentication } });
    expect(await run('passkeyOptions', event())).toMatchObject({ status: 404 });
    expect(await run('passkey', event({ challengeId: 'ch-1', credential }))).toMatchObject({
      status: 404,
    });
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it('signs in and finishes through the api, then goes where it said', async () => {
    const verifyAuthentication = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'jwt-a' }, user: { id: 'u1' } },
      error: null,
    });
    const { event, fetch } = setup({ passkey: { verifyAuthentication } });

    await expect(
      run('passkey', event({ challengeId: 'ch-1', credential, next: '/tables' })),
    ).rejects.toMatchObject({ status: 303, location: '/tables' });
    const request = (fetch.mock.calls[0] as unknown as [Request])[0];
    expect(new URL(request.url).pathname).toBe('/v1/auth/finish-login');
    expect(request.headers.get('authorization')).toBe('Bearer jwt-a');
  });

  it('says the passkey was refused when Supabase does not accept it', async () => {
    const verifyAuthentication = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'webauthn_verification_failed' } });
    const { event, fetch } = setup({ passkey: { verifyAuthentication } });

    expect(await run('passkey', event({ challengeId: 'ch-1', credential }))).toMatchObject({
      status: 400,
      data: { passkey: 'refused' },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an answer that is not a credential, without asking Supabase', async () => {
    const verifyAuthentication = vi.fn();
    const { event } = setup({ passkey: { verifyAuthentication } });
    expect(
      await run('passkey', event({ challengeId: 'ch-1', credential: '{"type":"password"}' })),
    ).toMatchObject({ status: 400, data: { passkey: 'invalid' } });
    expect(verifyAuthentication).not.toHaveBeenCalled();
  });
});
