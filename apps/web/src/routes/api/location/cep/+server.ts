import { error } from '@sveltejs/kit';
import { normalizeCep } from '@mesaaberta/core/location/cep';
import { RateLimited } from '@mesaaberta/core/server/errors';
import type { CepLookup } from '@mesaaberta/core/server/location/cep';
import { readFromApi } from '#lib/server/api-read.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');
  const value = normalizeCep(url.searchParams.get('value') ?? '');
  if (!value) error(400, 'Invalid CEP');
  setHeaders({ 'cache-control': 'private, no-store' });
  // The api limits the lookups per person and answers a provider outage as a 503.
  try {
    return Response.json(
      await readFromApi<CepLookup>(locals, user.id, `/v1/location/cep?value=${value}`),
    );
  } catch (cause) {
    if (!(cause instanceof RateLimited)) throw cause;
    setHeaders({ 'retry-after': String(cause.retryAfterSeconds) });
    error(429, 'Too many lookups');
  }
};
