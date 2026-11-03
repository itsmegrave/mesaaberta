import { currentRequestId, REQUEST_ID_HEADER } from '@mesaaberta/contracts';

/** The Service Binding to the api Worker (`env.API`). */
export type ApiBinding = { fetch: (request: Request) => Promise<Response> };

/** How the MCP reaches the api: the binding on Cloudflare, or the private address self-hosted. */
export type ApiEnv = { API?: ApiBinding; API_URL?: string; API_INTERNAL_TOKEN?: string };

/** What the api answered: its status and JSON body (null when the body was not JSON). */
export type ApiAnswer = { status: number; body: unknown };

/** Reads the api as one person. */
export type ApiReader = (path: string) => Promise<ApiAnswer>;

/**
 * A reader that calls the api as `actorId`, the way the web Worker does (`sendToApi`): the api
 * trusts `x-actor-id` only over the binding or with the shared secret, and checks that person's
 * account again on every route. Throws when neither way in is configured or the call fails.
 */
export function apiReader(env: ApiEnv, actorId: string): ApiReader {
  const binding = env.API;
  const remote = !binding && env.API_URL && env.API_INTERNAL_TOKEN ? env : null;
  if (!binding && !remote) throw new Error('api_unconfigured');
  const send = binding ? binding.fetch.bind(binding) : (request: Request) => fetch(request);
  // With a Service Binding the host is never resolved: it routes by binding, not by name.
  const origin = binding ? 'https://api.internal' : remote!.API_URL!.replace(/\/$/, '');
  return async (path) => {
    const requestId = currentRequestId();
    const response = await send(
      new Request(`${origin}${path}`, {
        headers: {
          'x-actor-id': actorId,
          ...(remote ? { 'x-internal-token': remote.API_INTERNAL_TOKEN! } : {}),
          ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
        },
        signal: AbortSignal.timeout(25_000),
      }),
    );
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  };
}

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
