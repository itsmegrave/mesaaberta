import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { handleSuspended } from './suspended';
import { stillBanned } from '../moderation/bans';

// The real lookup talks to the database; here only its answer matters (moderation.spec covers it).
vi.mock('../moderation/bans', () => ({
  stillBanned: vi.fn(async (_db: unknown, profile: { status: string }) => ({
    banned: profile.status === 'suspended',
    eventIds: [],
  })),
}));

const session = [{ name: 'sb-project-auth-token', value: 'x' }];

function setup(
  status: 'active' | 'suspended' | null,
  { cookies = session, path = '/tables' } = {},
) {
  const signOut = vi.fn();
  const getProfile = vi.fn().mockResolvedValue(status && { id: 'u', status, bannedUntil: null });
  const resolve = vi.fn().mockResolvedValue(new Response('ok'));
  const event = {
    url: new URL(`https://mesaaberta.app${path}`),
    cookies: { getAll: () => cookies },
    locals: { supabase: { auth: { signOut } }, getProfile, db: {} },
  };
  const run = () => handleSuspended({ event, resolve } as never);
  return { run, signOut, getProfile, resolve };
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
  });

  it('lets someone whose temporary ban ran out through, without signing them out', async () => {
    const { run, signOut, resolve, getProfile } = setup('suspended');
    getProfile.mockResolvedValue({ id: 'u', status: 'suspended', bannedUntil: new Date(0) });
    vi.mocked(stillBanned).mockResolvedValueOnce({ banned: false, eventIds: ['lifted'] });

    await run();

    expect(resolve).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
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
