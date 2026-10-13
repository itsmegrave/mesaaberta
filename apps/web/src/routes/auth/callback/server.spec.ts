import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

vi.mock('$lib/server/auth/login', () => ({ finishLogin: vi.fn().mockResolvedValue('/') }));

const call = async (query: string) => {
  const event = {
    url: new URL(`https://mesaaberta.test/auth/callback?${query}`),
    locals: { supabase: {}, db: null, log: {} },
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
  it('takes someone who was connecting an account back to their profile, saying why it failed', async () => {
    const next = encodeURIComponent('/account/profile?conta=conectada');

    expect(
      await call(`error=server_error&error_code=identity_already_exists&next=${next}`),
    ).toMatchObject({
      status: 303,
      location: '/account/profile?conta=de_outra_pessoa',
    });
    expect(await call(`error=access_denied&next=${next}`)).toMatchObject({
      location: '/account/profile?conta=falhou',
    });
  });

  it('leaves a refused sign-in to the login flow', async () => {
    expect(await call('error=access_denied')).toMatchObject({ location: '/' });
  });
});
