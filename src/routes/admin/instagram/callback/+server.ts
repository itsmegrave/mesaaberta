import { error, redirect } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';
import { instagramAccounts } from '$lib/server/db/schema';
import {
  configured,
  encryptToken,
  exchangeCode,
  graph,
  type InstagramEnv,
} from '$lib/server/instagram/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, cookies, url }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  const expected = cookies.get('instagram_oauth_state');
  cookies.delete('instagram_oauth_state', { path: '/admin/instagram' });
  const env = platform?.env as InstagramEnv | undefined;
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
