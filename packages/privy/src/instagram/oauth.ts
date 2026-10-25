import type { OAuthConnection } from '@mesaaberta/core/server/extensions/contract';
import {
  callbackUrl,
  configured,
  encryptToken,
  exchangeCode,
  graph,
  SCOPES,
  type InstagramEnv,
} from './api';

/** Connecting the one Mesa Aberta account with Instagram's own OAuth (Business Login). */
export const instagramOAuth: OAuthConnection = {
  origin: 'https://www.instagram.com',
  configured: (env) => configured(env as InstagramEnv | undefined),
  authorizeUrl(env, state) {
    const instagram = env as InstagramEnv;
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: instagram.INSTAGRAM_APP_ID!,
      redirect_uri: callbackUrl(instagram),
      response_type: 'code',
      scope: SCOPES,
      state,
      enable_fb_login: '0',
      force_authentication: '1',
    }).toString();
    return url;
  },
  async complete(env, code, save) {
    const instagram = env as InstagramEnv & { INSTAGRAM_TOKEN_KEY?: string };
    const token = await exchangeCode(instagram, code);
    const me = await graph<{ id: string; user_id?: string; username: string }>(
      instagram,
      token.access_token,
      'me',
      { fields: 'user_id,username' },
    );
    const userId = me.user_id ?? me.id;
    if (!userId || !me.username || !token.access_token || !(token.expires_in > 0))
      throw new Error('Invalid Instagram account');
    // Only the encrypted token goes on: never the plain one, and never the app secret.
    await save('connect', {
      userId,
      username: me.username,
      token: await encryptToken(token.access_token, instagram.INSTAGRAM_TOKEN_KEY!),
      expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });
  },
};
