import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { postalCodes } from '../db/schema';
import { areaOf, type CepPlace } from '$lib/location/cep';
import type { TableInput } from '$lib/tables/schema';
import { Invalid } from '../errors';

export type CepLookup =
  { status: 'found'; place: CepPlace } | { status: 'not_found' } | { status: 'unavailable' };

const TIMEOUT_MS = 3000;
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * What a CEP (8 digits, already normalised) resolves to. From the `postal_codes` cache when it has
 * been seen before; otherwise from ViaCEP, whose answer is kept. `unavailable` when ViaCEP fails or
 * is slow: the caller decides whether that blocks anything (it never blocks a table without CEP).
 */
export async function lookupCep(
  db: AnyDb,
  cep: string,
  request: typeof fetch = fetch,
): Promise<CepLookup> {
  const [known] = await db
    .select({
      neighbourhood: postalCodes.neighbourhood,
      city: postalCodes.city,
      state: postalCodes.state,
    })
    .from(postalCodes)
    .where(eq(postalCodes.cep, cep));
  if (known) return { status: 'found', place: known };

  let body: Record<string, unknown>;
  try {
    const response = await request(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { status: 'unavailable' };
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { status: 'unavailable' };
  }

  // ViaCEP answers 200 with `erro` for a well-formed CEP that does not exist.
  if (body.erro === true || body.erro === 'true') return { status: 'not_found' };

  const city = text(body.localidade);
  const state = text(body.uf).toUpperCase();
  if (!city || !/^[A-Z]{2}$/.test(state)) return { status: 'unavailable' };

  const place = { neighbourhood: text(body.bairro) || null, city, state };
  await db
    .insert(postalCodes)
    .values({ cep, ...place })
    .onConflictDoNothing();

  return { status: 'found', place };
}

/**
 * Resolves the CEP of an in-person table before it is saved: the neighbourhood, city and state are
 * stored, and they become the public area unless the GM typed one. A CEP that does not exist is
 * refused. When ViaCEP is down the table is still saved if it has an area; otherwise the GM is asked
 * for one. Throws `Invalid` on the `postalCode` field.
 */
export async function withLocation(
  db: AnyDb,
  input: TableInput,
  request: typeof fetch = fetch,
): Promise<TableInput> {
  if (!input.postalCode) return input;

  const found = await lookupCep(db, input.postalCode, request);
  if (found.status === 'not_found') throw new Invalid('postalCode', 'not_found');
  if (found.status === 'unavailable') {
    if (!input.locationArea) throw new Invalid('postalCode', 'unavailable');
    return input;
  }

  return {
    ...input,
    locationArea: input.locationArea || areaOf(found.place),
    locationNeighbourhood: found.place.neighbourhood,
    locationCity: found.place.city,
    locationState: found.place.state,
  };
}
