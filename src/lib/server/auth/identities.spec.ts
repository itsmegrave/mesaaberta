import { describe, expect, it, vi } from 'vitest';
import { Forbidden, Invalid, NotFound } from '../errors';
import { connections, startLink, unlink } from './identities';

const origin = 'https://mesaaberta.test';

// What Supabase gives back for an identity: far more than the app may show.
const identity = (provider: string) => ({
  id: `${provider}-id`,
  identity_id: `identity-${provider}`,
  user_id: 'user-1',
  provider,
  identity_data: { email: 'ana@example.com', sub: 'secret-provider-id' },
});

const client = (identities: object[], over: Record<string, unknown> = {}) => ({
  auth: {
    getUserIdentities: vi.fn().mockResolvedValue({ data: { identities }, error: null }),
    linkIdentity: vi
      .fn()
      .mockResolvedValue({ data: { url: 'https://discord.com/oauth' }, error: null }),
    unlinkIdentity: vi.fn().mockResolvedValue({ error: null }),
    ...over,
  },
});

describe('connections', () => {
  it('says which providers are connected and whether email sign-in exists, and nothing else', async () => {
    const result = await connections(client([identity('email'), identity('google')]) as never);

    expect(result).toEqual({
      providers: [
        { provider: 'google', connected: true },
        { provider: 'discord', connected: false },
      ],
      email: true,
      total: 2,
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|ana@|identity-/);
  });

  it('throws when Supabase cannot list them, rather than showing a wrong state', async () => {
    const failing = client([], {
      getUserIdentities: vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } }),
    });

    await expect(connections(failing as never)).rejects.toThrow('could not list');
  });
});

describe('startLink', () => {
  it('asks Supabase to link the provider, coming back through the callback to the profile', async () => {
    const supabase = client([identity('google')]);

    const url = await startLink(supabase as never, { provider: 'discord', origin });

    expect(url).toBe('https://discord.com/oauth');
    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'discord',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/account/profile?conta=conectada')}`,
        skipBrowserRedirect: true,
      },
    });
  });

  it('does not let next point at another site', async () => {
    const supabase = client([]);

    await startLink(supabase as never, {
      provider: 'discord',
      origin,
      next: 'https://evil.example',
    });

    const { options } = supabase.auth.linkIdentity.mock.calls[0][0];
    expect(options.redirectTo).toContain(encodeURIComponent('/account/profile'));
    expect(options.redirectTo).not.toContain('evil');
  });

  it('returns null when Supabase gives no URL (manual linking off, provider disabled)', async () => {
    const supabase = client([], {
      linkIdentity: vi.fn().mockResolvedValue({ data: { url: null }, error: { message: 'off' } }),
    });

    expect(await startLink(supabase as never, { provider: 'discord', origin })).toBeNull();
  });
});

describe('unlink', () => {
  it('disconnects a provider when another way to sign in remains', async () => {
    const supabase = client([identity('google'), identity('discord')]);

    await unlink(supabase as never, 'discord');

    expect(supabase.auth.unlinkIdentity).toHaveBeenCalledWith(identity('discord'));
  });

  it('never removes the last way to sign in', async () => {
    const supabase = client([identity('google')]);

    await expect(unlink(supabase as never, 'google')).rejects.toBeInstanceOf(Forbidden);
    expect(supabase.auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it('counts email and password as a way to sign in', async () => {
    const supabase = client([identity('email'), identity('google')]);

    await unlink(supabase as never, 'google');

    expect(supabase.auth.unlinkIdentity).toHaveBeenCalled();
  });

  it('says so for a provider that is not connected', async () => {
    const supabase = client([identity('google'), identity('email')]);

    await expect(unlink(supabase as never, 'discord')).rejects.toBeInstanceOf(NotFound);
  });

  it('turns a Supabase refusal into a domain error', async () => {
    const supabase = client([identity('google'), identity('discord')], {
      unlinkIdentity: vi.fn().mockResolvedValue({ error: { message: 'nope' } }),
    });

    await expect(unlink(supabase as never, 'discord')).rejects.toBeInstanceOf(Invalid);
  });
});
