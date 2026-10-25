import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptToken } from './api';
import { instagramOAuth } from './oauth';

const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)));
const env = {
  APP_ORIGIN: 'https://mesaaberta.app',
  INSTAGRAM_APP_ID: 'app-id',
  INSTAGRAM_APP_SECRET: 'app-secret',
  INSTAGRAM_TOKEN_KEY: key,
};

afterEach(() => vi.unstubAllGlobals());

describe('the Instagram connection', () => {
  it('is configured only with the app, its secret, the token key and an https origin', () => {
    expect(instagramOAuth.configured(env)).toBe(true);
    expect(instagramOAuth.configured(undefined)).toBe(false);
    expect(instagramOAuth.configured({ ...env, INSTAGRAM_TOKEN_KEY: undefined })).toBe(false);
    expect(instagramOAuth.configured({ ...env, APP_ORIGIN: 'http://mesaaberta.app' })).toBe(false);
  });

  it('sends the admin to Instagram, coming back at the callback Meta has on file', () => {
    const url = instagramOAuth.authorizeUrl(env, 'the-state');

    expect(url.origin).toBe(instagramOAuth.origin);
    expect(url.pathname).toBe('/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'app-id',
      redirect_uri: 'https://mesaaberta.app/admin/instagram/callback',
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_content_publish',
      state: 'the-state',
      enable_fb_login: '0',
      force_authentication: '1',
    });
  });

  it('saves the account with the token sealed, never the plain token or the app secret', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input);
        if (url.includes('api.instagram.com/oauth/access_token'))
          return Response.json({ access_token: 'short' });
        if (url.includes('access_token?grant_type=ig_exchange_token'))
          return Response.json({ access_token: 'long-token', expires_in: 5_184_000 });
        if (url.includes('/me'))
          return Response.json({ id: 'fallback', user_id: '17', username: 'mesaaberta' });
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const save = vi.fn(async () => undefined);

    const before = Date.now();
    await instagramOAuth.complete(env, 'the-code', save);

    expect(save).toHaveBeenCalledOnce();
    const [action, data] = save.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(action).toBe('connect');
    expect(data).toMatchObject({ userId: '17', username: 'mesaaberta' });
    expect(JSON.stringify(data)).not.toContain('long-token');
    expect(JSON.stringify(data)).not.toContain('app-secret');
    expect(await decryptToken(data.token, key)).toBe('long-token');
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThanOrEqual(before + 5_184_000_000);
  });

  it('saves nothing when Instagram answers without a usable account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input);
        if (url.includes('api.instagram.com/oauth/access_token'))
          return Response.json({ access_token: 'short' });
        if (url.includes('ig_exchange_token'))
          return Response.json({ access_token: 'long-token', expires_in: 0 });
        return Response.json({ id: '17', username: 'mesaaberta' });
      }),
    );
    const save = vi.fn(async () => undefined);

    await expect(instagramOAuth.complete(env, 'c', save)).rejects.toThrow(
      'Invalid Instagram account',
    );
    expect(save).not.toHaveBeenCalled();
  });
});
