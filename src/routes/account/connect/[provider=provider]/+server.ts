import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { startLink } from '$lib/server/auth/identities';
import type { RequestHandler } from './$types';

// A plain GET, like the login: the redirect chain through Supabase and the provider is not a form
// post, so the Content-Security-Policy `form-action` rule does not apply to it. It changes nothing
// on our side, and only the signed-in person's own browser can finish it.
export const GET: RequestHandler = async ({ params, url, locals }) => {
  await requireUser(locals, url);
  if (!locals.supabase) redirect(303, '/account/profile?conta=indisponivel');

  const target = await startLink(locals.supabase, {
    provider: params.provider as never,
    origin: url.origin,
  });
  if (!target) {
    locals.log.error('connect: Supabase gave no provider URL', { provider: params.provider });
    redirect(303, '/account/profile?conta=falhou');
  }

  redirect(303, target);
};
