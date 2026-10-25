import { error, redirect } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { extensionById } from '@mesaaberta/core/server/extensions/index';
import type { RequestHandler } from './$types';

/** Starts an extension's OAuth connection: remember a state, then leave for its authorize page. */
export const POST: RequestHandler = async ({ locals, cookies, params }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  const oauth = extensionById(params.ext)?.oauth;
  if (!oauth) error(404);
  if (!oauth.configured(locals.env)) error(503, 'Not configured');
  const state = crypto.randomUUID();
  cookies.set(`${params.ext}_oauth_state`, state, {
    path: `/admin/${params.ext}`,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });
  // To the network's own OAuth page: SvelteKit 3 wants external redirects allowed by origin.
  redirect(303, oauth.authorizeUrl(locals.env, state).href, { external: [oauth.origin] });
};
