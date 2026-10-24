import { error, redirect } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { instagramAccounts } from '@mesaaberta/core/server/db/schema';
import { instagramViaApi } from '#lib/server/admin/instagram-api.js';
import {
  configured,
  encryptToken,
  exchangeCode,
  graph,
  type InstagramEnv,
} from '@mesaaberta/core/server/instagram/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const admin = await locals.getProfile();
  if (!can(admin, 'admin:access')) error(404);
  const expected = cookies.get('instagram_oauth_state');
  cookies.delete('instagram_oauth_state', { path: '/admin/instagram' });
  const env = locals.env as InstagramEnv | undefined;
  if (!configured(env) || !locals.db) error(503);
  if (!expected || url.searchParams.get('state') !== expected) error(400, 'Invalid OAuth state');
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.has('error')) redirect(303, '/admin/instagram?connection_error=1');
  try {
    const token = await exchangeCode(env!, code);
    const me = await graph<{ id: string; user_id?: string; username: string }>(
      env!,
      token.access_token,
      'me',
      { fields: 'user_id,username' },
    );
    const userId = me.user_id ?? me.id;
    if (!userId || !me.username || !token.access_token || !(token.expires_in > 0))
      throw new Error('Invalid Instagram account');
    const values = {
      userId,
      username: me.username,
      token: await encryptToken(token.access_token, env!.INSTAGRAM_TOKEN_KEY!),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
    };
    // Behind `api_admin_instagram` the api Worker saves the account (only the encrypted token goes
    // over); a call that cannot be made saves it here.
    const remote = await instagramViaApi(locals, admin!.id, 'connect', {
      userId: values.userId,
      username: values.username,
      token: values.token,
      expiresAt: values.expiresAt.toISOString(),
    });
    if (remote && 'invalid' in remote) throw new Error('Invalid Instagram account');
    if (!remote)
      await locals.db
        .insert(instagramAccounts)
        .values(values)
        .onConflictDoUpdate({ target: instagramAccounts.id, set: values });
  } catch {
    // Never log an OAuth error: it may contain the authorization code or exchanged token.
    redirect(303, '/admin/instagram?connection_error=1');
  }
  redirect(303, '/admin/instagram?connected=1');
};
