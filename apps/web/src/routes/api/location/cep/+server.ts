import { error, json } from '@sveltejs/kit';
import { normalizeCep } from '$lib/location/cep';
import { lookupCep } from '$lib/server/location/cep';
import { recordAttempt } from '$lib/server/auth/attempt-limit';
import { RateLimited } from '$lib/server/errors';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');
  const value = normalizeCep(url.searchParams.get('value') ?? '');
  if (!value) error(400, 'Invalid CEP');
  if (!locals.db) error(503, 'Database unavailable');
  setHeaders({ 'cache-control': 'private, no-store' });
  try {
    await recordAttempt(locals.db, { action: 'cep_lookup', max: 60, windowSeconds: 60 }, user.id);
  } catch (cause) {
    if (!(cause instanceof RateLimited)) throw cause;
    setHeaders({ 'retry-after': String(cause.retryAfterSeconds) });
    error(429, 'Too many lookups');
  }
  const result = await lookupCep(locals.db, value);
  if (result.status === 'unavailable') error(503, 'Address lookup unavailable');
  return json(result);
};
