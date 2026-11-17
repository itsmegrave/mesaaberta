import { redirect } from '@sveltejs/kit';
import { startLogin } from '@mesaaberta/core/server/auth/login';
import { supabaseOnly } from '#lib/server/auth/external-redirect.js';
import type { RequestHandler } from './$types';

// A plain GET (a link, not a form) so the Content-Security-Policy `form-action` rule does not
// apply to the redirect chain through Supabase and the provider. Starting a login changes nothing
// on our side beyond the PKCE cookie, and only the visitor's own browser can finish it.
export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!locals.supabase) redirect(303, '/login?error=unavailable');

  const target = await startLogin(locals.supabase, {
    provider: params.provider as never,
    origin: url.origin,
    next: url.searchParams.get('next'),
  });
  if (!target) {
    locals.log.error('auth.login_no_provider_url', { provider: params.provider });
    redirect(303, '/login?error=start_failed');
  }

  // Out to Supabase Auth (and on to the provider): SvelteKit 3 wants external redirects allowed by origin.
  redirect(303, target, supabaseOnly(locals.env));
};
