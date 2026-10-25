import { redirect } from '@sveltejs/kit';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { attemptKey } from '@mesaaberta/core/server/auth/attempt-limit';
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
  // Behind `api_auth_finish_login` the api Worker does the database half with the new access token;
  // nothing here can be used (flag off, no binding, an answer it does not know) means null, and the
  // web Worker does it. Nobody is known yet, so the visitor's network (hashed) stands in for the id.
  const remote = async (accessToken: string, next: string | null) => {
    if (
      !(await locals.flags.isEnabled('api_auth_finish_login', {
        id: await attemptKey('sign_in', ip),
      }))
    )
      return null;
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
    { supabase: locals.supabase, db: locals.db, log: locals.log, ip, remote },
    { code: url.searchParams.get('code'), next: url.searchParams.get('next') },
  );

  redirect(303, target);
};
