import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { requireRecentSignIn, requireUser } from './guard';

const done = { username: 'ana' };
const locals = (user: unknown, profile: { username: string | null } | null = done) =>
  ({ getUser: async () => user, getProfile: async () => profile }) as App.Locals;

describe('requireUser', () => {
  it('returns the signed-in user', async () => {
    const user = { id: 'u1' } as User;

    expect(await requireUser(locals(user), new URL('https://x.test/t/new'))).toBe(user);
  });

  it('sends an anonymous visitor to log in, and back afterwards', async () => {
    await expect(
      requireUser(locals(null), new URL('https://x.test/t/new?draft=1')),
    ).rejects.toMatchObject({ status: 303, location: '/login?next=%2Ftables%2Fnew%3Fdraft%3D1' });
  });

  it.each([
    ['a profile without a username', { username: null }],
    ['no profile at all', null],
  ])('sends %s to finish the profile, and back afterwards', async (_what, profile) => {
    await expect(
      requireUser(locals({ id: 'u1' }, profile), new URL('https://x.test/t/new?draft=1')),
    ).rejects.toMatchObject({
      status: 303,
      location: '/u/profile/setup?next=%2Ftables%2Fnew%3Fdraft%3D1',
    });
  });

  it('lets the onboarding itself through with an incomplete profile', async () => {
    const user = { id: 'u1' } as User;

    expect(
      await requireUser(
        locals(user, { username: null }),
        new URL('https://x.test/u/profile/setup'),
        {
          allowIncomplete: true,
        },
      ),
    ).toBe(user);
  });

  it('still sends an anonymous visitor to log in from the onboarding', async () => {
    await expect(
      requireUser(locals(null), new URL('https://x.test/u/profile/setup'), {
        allowIncomplete: true,
      }),
    ).rejects.toMatchObject({ status: 303 });
  });
});

describe('requireRecentSignIn', () => {
  const withSignIn = (minutesAgo: number | null) => {
    const signOut = vi.fn(async () => ({ error: null }));
    const locals = {
      signedInAt: async () => (minutesAgo === null ? null : Date.now() - minutesAgo * 60_000),
      supabase: { auth: { signOut } },
    } as unknown as App.Locals;
    return { locals, signOut };
  };
  const page = new URL('https://x.test/u/profile/edit/account?/passkeyRegister');

  it('lets a recent sign-in through', async () => {
    const { locals, signOut } = withSignIn(3);
    await expect(requireRecentSignIn(locals, page)).resolves.toBeUndefined();
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([
    ['a session that only stayed open', 60],
    ['a session with no sign-in time', null],
  ])('ends %s and sends the person to sign in again, back to the page', async (_what, ago) => {
    const { locals, signOut } = withSignIn(ago);
    await expect(requireRecentSignIn(locals, page)).rejects.toMatchObject({
      status: 303,
      location: '/login?next=%2Fu%2Fprofile%2Fedit%2Faccount&reauth=1',
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
