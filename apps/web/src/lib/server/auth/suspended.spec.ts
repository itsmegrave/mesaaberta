import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { handleSuspended } from './suspended';
import { readFromApi } from '../api-read';

// The api lifts a ban whose time is up; here only its answer matters (me.db.spec covers it).
vi.mock('../api-read', () => ({ readFromApi: vi.fn() }));

const session = [{ name: 'sb-project-auth-token', value: 'x' }];

function setup(
  status: 'active' | 'suspended' | null,
  { cookies = session, path = '/tables' } = {},
) {
  const signOut = vi.fn();
  const getProfile = vi.fn().mockResolvedValue(status && { id: 'u', status, bannedUntil: null });
  const resolve = vi.fn().mockResolvedValue(new Response('ok'));
  const afterResponse = vi.fn();
  const event = {
    url: new URL(`https://mesaaberta.app${path}`),
    cookies: { getAll: () => cookies },
    locals: { supabase: { auth: { signOut } }, getProfile, afterResponse },
  };
  const run = () => handleSuspended({ event, resolve } as never);
  return { run, signOut, getProfile, resolve, afterResponse };
}

describe('handleSuspended', () => {
  it('signs a suspended account out and sends it to the login page', async () => {
    const { run, signOut, resolve } = setup('suspended');

    const thrown = await Promise.resolve()
      .then(run)
      .catch((error: unknown) => error);

    expect(isRedirect(thrown) && thrown.location).toBe('/login?error=suspended');
    expect(signOut).toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    // A ban with no end, or one still running, needs no call.
    expect(readFromApi).not.toHaveBeenCalled();
  });

  it('lets someone whose temporary ban ran out through, without signing them out', async () => {
    const { run, signOut, resolve, getProfile, afterResponse } = setup('suspended');
    const profile = { id: 'u', status: 'suspended', bannedUntil: new Date(0) };
    getProfile.mockResolvedValue(profile);
    vi.mocked(readFromApi).mockResolvedValueOnce({ banned: false, eventIds: ['lifted'] });

    await run();

    expect(vi.mocked(readFromApi).mock.lastCall?.slice(1)).toEqual(['u', '/v1/me/ban-check', {}]);
    expect(afterResponse).toHaveBeenCalledOnce();
    expect(profile).toMatchObject({ status: 'active', bannedUntil: null });
    expect(resolve).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('keeps someone barred when the api says the account is still closed', async () => {
    const { run, signOut, getProfile } = setup('suspended', { path: '/login' });
    getProfile.mockResolvedValue({ id: 'u', status: 'suspended', bannedUntil: new Date(0) });
    vi.mocked(readFromApi).mockResolvedValueOnce({ banned: true, eventIds: [] });

    await run();

    expect(signOut).toHaveBeenCalled();
  });

  it('lets an active account through', async () => {
    const { run, signOut, resolve } = setup('active');

    await run();

    expect(resolve).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('costs an anonymous visitor no profile lookup', async () => {
    const { run, getProfile, resolve } = setup(null, { cookies: [] });

    await run();

    expect(getProfile).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalled();
  });

  it('shows the login page itself, signed out, instead of redirecting to it again', async () => {
    const { run, signOut, resolve } = setup('suspended', { path: '/login' });

    await run();

    expect(signOut).toHaveBeenCalled();
    expect(resolve).toHaveBeenCalled();
  });
});
