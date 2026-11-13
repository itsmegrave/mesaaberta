import type { CompleteLoginResult } from '@mesaaberta/core/server/auth/login';
import { callApiRaw } from '#lib/server/api-client.js';

/**
 * The database half of a sign-in that made its session here (a provider's code, a passkey), done by
 * the api Worker with the new access token: the profile, the ban check, the connection record and
 * where to go. An answer it does not know (no binding, a failure) is null, and the caller signs the
 * person out again.
 */
export const finishLoginViaApi =
  (locals: App.Locals, ip: string) =>
  async (accessToken: string, next: string | null): Promise<CompleteLoginResult | null> => {
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
