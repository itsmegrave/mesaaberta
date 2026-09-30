import { error, redirect } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';
import { callbackUrl, configured, SCOPES, type InstagramEnv } from '$lib/server/instagram/api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, cookies }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  const env = platform?.env as InstagramEnv | undefined;
  if (!configured(env)) error(503, 'Instagram not configured');
  const state = crypto.randomUUID();
  cookies.set('instagram_oauth_state', state, {
    path: '/admin/instagram',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: env!.INSTAGRAM_APP_ID!,
    redirect_uri: callbackUrl(env!),
    response_type: 'code',
    scope: SCOPES,
    state,
    enable_fb_login: '0',
    force_authentication: '1',
  }).toString();
  redirect(303, url.href);
};
