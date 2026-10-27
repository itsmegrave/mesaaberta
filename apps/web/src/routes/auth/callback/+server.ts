import { redirect } from '@sveltejs/kit';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { finishLogin, type CompleteLoginResult } from '@mesaaberta/core/server/auth/login';
import { callApiRaw } from '#lib/server/api-client.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
  if (!locals.supabase) redirect(303, '/login?error=unavailable');

  // The provider or Supabase refused (the account is already connected to someone else, say) and
  // sent no code. Someone who was connecting goes back to their profile to read why, not to the login.
  const refused = url.searchParams.get('error_code') ?? url.searchParams.get('error');
  if (refused && safeNext(url.searchParams.get('next')).startsWith('/u/profile/edit')) {
    redirect(
      303,
      `/u/profile/edit/account?conta=${refused === 'identity_already_exists' ? 'de_outra_pessoa' : 'falhou'}`,
    );
  }

  const ip = getClientAddress();
  // The api Worker does the database half with the new access token. An answer it does not know
  // (no binding, a failure) is null: the person is signed out again and sent to the login page.
  const remote = async (accessToken: string, next: string | null) => {
    const answer = await callApiRaw(
      locals.env,
      '/v1/auth/finish-login',
      null,
      locals.log,
      { next },
      { authorization: `Bearer ${accessToken}`, 'x-client-ip': ip },
    );
    const done = answer?.body as CompleteLoginResult | undefined;
    if (done?.result === 'ok' && typeof done.target === 'string') return done;
    if (done?.result === 'profile_failed' || done?.result === 'suspended') return done;
    return null;
  };

  const target = await finishLogin(
    // No database here: the profile, the ban check and the connection record live in the api.
    { supabase: locals.supabase, db: null, log: locals.log, ip, remote },
    { code: url.searchParams.get('code'), next: url.searchParams.get('next') },
  );

  redirect(303, target);
};
