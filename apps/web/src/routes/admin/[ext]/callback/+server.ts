import { error, redirect } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { extensionById } from '@mesaaberta/core/server/extensions/index';
import { extensionAction } from '#lib/server/admin/extension-api.js';
import type { RequestHandler } from './$types';

/**
 * Where an extension's OAuth connection comes back to. The extension trades the code and names the
 * admin action that saves the account; the api Worker runs it (only what the extension passes goes
 * over, which is never a plain token).
 */
export const GET: RequestHandler = async ({ locals, cookies, url, params }) => {
  const admin = await locals.getProfile();
  if (!can(admin, 'admin:access')) error(404);
  const extension = extensionById(params.ext);
  const oauth = extension?.oauth;
  if (!extension || !oauth) error(404);
  const expected = cookies.get(`${params.ext}_oauth_state`);
  cookies.delete(`${params.ext}_oauth_state`, { path: `/admin/${params.ext}` });
  const env = locals.env;
  if (!oauth.configured(env)) error(503);
  if (!expected || url.searchParams.get('state') !== expected) error(400, 'Invalid OAuth state');
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.has('error'))
    redirect(303, `/admin/${params.ext}?connection_error=1`);
  try {
    await oauth.complete(env, code, async (name, data) => {
      const answer = await extensionAction(locals, params.ext, admin!.id, name, data);
      if ('invalid' in answer) throw new Error('Invalid account');
    });
  } catch {
    // Never log an OAuth error: it may contain the authorization code or exchanged token.
    redirect(303, `/admin/${params.ext}?connection_error=1`);
  }
  redirect(303, `/admin/${params.ext}?connected=1`);
};
