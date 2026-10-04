import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/server/auth/safe-next';
import { finishLogin } from '$lib/server/auth/login';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
  if (!locals.supabase) redirect(303, '/login?error=unavailable');

  // The provider or Supabase refused (the account is already connected to someone else, say) and
  // sent no code. Someone who was connecting goes back to their profile to read why, not to the login.
  const refused = url.searchParams.get('error_code') ?? url.searchParams.get('error');
  if (refused && safeNext(url.searchParams.get('next')).startsWith('/account/profile')) {
    redirect(
      303,
      `/account/profile?conta=${refused === 'identity_already_exists' ? 'de_outra_pessoa' : 'falhou'}`,
    );
  }

  const target = await finishLogin(
    { supabase: locals.supabase, db: locals.db, log: locals.log, ip: getClientAddress() },
    { code: url.searchParams.get('code'), next: url.searchParams.get('next') },
  );

  redirect(303, target);
};
