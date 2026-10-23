import { logger, type Logger } from '@mesaaberta/core/server/logger';

/** The Service Binding to the api Worker (`env.API`); absent until the api is deployed and bound. */
export type ApiBinding = { fetch: (request: Request) => Promise<Response> };

/**
 * The api path as a template, for logs: a table's slug and any id become `:param`, so telemetry
 * carries which route failed and never which table, partner or person it was about.
 */
export function routeTemplate(path: string): string {
  const segments = path.split('?')[0].split('/');
  return segments
    .map((segment, i) => {
      const before = segments[i - 1];
      const dynamic =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
        before === 'tables' ||
        before === 'manage' ||
        (before === 'table-writes' && i < segments.length - 1);
      return dynamic ? ':param' : segment;
    })
    .join('/');
}

/** What the api answered, whatever the status; null from `callApiRaw` means nothing was answered. */
export type ApiAnswer = { ok: boolean; status: number; body: unknown };

/**
 * Calls the api Worker over its Service Binding as `actorId` (the api checks that person is an
 * admin again). Resolves to null only when the call could not be made (no binding, a network error
 * or a body that is not JSON), so the caller can keep its own path; any answer, a refusal included,
 * is returned. Never throws.
 */
export async function callApiRaw(
  env: App.Locals['env'],
  path: string,
  actorId: string | null,
  log: Logger = logger,
  json?: unknown,
  headers: Record<string, string> = {},
  method: 'GET' | 'POST' = 'POST',
): Promise<ApiAnswer | null> {
  const settings = env as
    { API?: ApiBinding; API_URL?: string; API_INTERNAL_TOKEN?: string } | undefined;
  // On Cloudflare the Service Binding; self-hosted, the api's private address and its shared secret.
  const binding = settings?.API;
  const remote = !binding && settings?.API_URL && settings.API_INTERNAL_TOKEN ? settings : null;
  if (!binding && !remote) return null;
  try {
    // With a Service Binding the host is never resolved: it routes by binding, not by name.
    const send = binding ? binding.fetch.bind(binding) : (request: Request) => fetch(request);
    const origin = binding ? 'https://api.internal' : remote!.API_URL!.replace(/\/$/, '');
    const response = await send(
      new Request(`${origin}${path}`, {
        method,
        headers: {
          ...headers,
          ...(remote ? { 'x-internal-token': remote.API_INTERNAL_TOKEN! } : {}),
          ...(actorId ? { 'x-actor-id': actorId } : {}),
          ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(json === undefined ? {} : { body: JSON.stringify(json) }),
        signal: AbortSignal.timeout(25_000),
      }),
    );
    return { ok: response.ok, status: response.status, body: await response.json() };
  } catch (error) {
    log.warn('api call failed', { code: 'api_call_failed', route: routeTemplate(path), error });
    return null;
  }
}

/**
 * Like `callApiRaw`, for callers that only want a success: null on a refusal as well, so the caller
 * keeps its own path: the web Worker stays the default and the api is the opt-in (Trello #120,
 * strangler).
 */
export async function callApi<T>(
  env: App.Locals['env'],
  path: string,
  actorId: string,
  log: Logger = logger,
): Promise<T | null> {
  const answer = await callApiRaw(env, path, actorId, log);
  if (!answer) return null;
  if (!answer.ok) {
    log.warn('api call refused', {
      code: 'api_call_refused',
      route: routeTemplate(path),
      status: answer.status,
      reason: (answer.body as { error?: unknown } | null)?.error as string | undefined,
    });
    return null;
  }
  return answer.body as T;
}
