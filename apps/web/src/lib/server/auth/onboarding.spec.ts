import { describe, expect, it } from 'vitest';
import {
  afterSignIn,
  needsOnboarding,
  onboardingUrl,
} from '@mesaaberta/core/server/auth/onboarding';

const locals = (profile: { username: string | null } | null) =>
  ({ getProfile: async () => profile }) as App.Locals;

describe('needsOnboarding', () => {
  it.each([
    [null, true],
    [{ username: null }, true],
    [{ username: '' }, true],
    [{ username: 'ana' }, false],
  ])('for the profile %j: %s', (profile, expected) => {
    expect(needsOnboarding(profile)).toBe(expected);
  });
});

describe('afterSignIn', () => {
  it('goes on to where the person was going when the profile is complete', async () => {
    expect(await afterSignIn(locals({ username: 'ana' }), '/t/new')).toBe('/t/new');
  });

  it('goes through the onboarding first, remembering where the person was going', async () => {
    expect(await afterSignIn(locals({ username: null }), '/t/new?x=1')).toBe(
      onboardingUrl('/t/new?x=1'),
    );
    expect(onboardingUrl('/t/new?x=1')).toBe('/u/profile/setup?next=%2Ft%2Fnew%3Fx%3D1');
  });

  it('never carries an address that leaves the site through the onboarding', async () => {
    expect(await afterSignIn(locals({ username: null }), '//evil.example')).toBe(
      '/u/profile/setup?next=%2F',
    );
  });
});
