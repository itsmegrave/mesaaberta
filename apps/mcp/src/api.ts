import { currentRequestId, REQUEST_ID_HEADER } from '@mesaaberta/contracts';

/** The Service Binding to the api Worker (`env.API`). */
export type ApiBinding = { fetch: (request: Request) => Promise<Response> };

/** How the MCP reaches the api: the binding on Cloudflare, or the private address self-hosted. */
export type ApiEnv = { API?: ApiBinding; API_URL?: string; API_INTERNAL_TOKEN?: string };

/** What the api answered: its status and JSON body (null when the body was not JSON). */
export type ApiAnswer = { status: number; body: unknown };

/** Reads the api as one person. */
export type ApiReader = (path: string) => Promise<ApiAnswer>;

/** Sends a write (a JSON POST) to the api as one person. */
export type ApiWriter = (path: string, body: unknown) => Promise<ApiAnswer>;

/**
 * The api as `actorId`, the way the web Worker calls it (`sendToApi`): the api trusts
 * `x-actor-id` only over the binding or with the shared secret, and checks that person's account
 * and permissions again on every route. Throws when neither way in is configured; each call throws
 * when the request fails.
 */
export function apiClient(env: ApiEnv, actorId: string): { read: ApiReader; write: ApiWriter } {
  const binding = env.API;
  const remote = !binding && env.API_URL && env.API_INTERNAL_TOKEN ? env : null;
  if (!binding && !remote) throw new Error('api_unconfigured');
  const send = binding ? binding.fetch.bind(binding) : (request: Request) => fetch(request);
  // With a Service Binding the host is never resolved: it routes by binding, not by name.
  const origin = binding ? 'https://api.internal' : remote!.API_URL!.replace(/\/$/, '');
  const call = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const requestId = currentRequestId();
    const response = await send(
      new Request(`${origin}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'x-actor-id': actorId,
          ...(remote ? { 'x-internal-token': remote.API_INTERNAL_TOKEN! } : {}),
          ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(25_000),
      }),
    );
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  };
  return {
    read: (path) => call(path),
    write: (path, body) => call(path, { method: 'POST', body }),
  };
}

/** Only the reads of {@link apiClient}. */
export const apiReader = (env: ApiEnv, actorId: string): ApiReader => apiClient(env, actorId).read;

/** The query string for `params`, empty values left out and arrays as a repeated key. */
export function queryOf(params: Record<string, string | number | boolean | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value)) for (const item of value) search.append(key, item);
    else search.set(key, value === true ? '1' : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
