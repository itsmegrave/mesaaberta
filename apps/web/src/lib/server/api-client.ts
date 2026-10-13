import { logger, type Logger } from '@mesaaberta/core/server/logger';

/** The Service Binding to the api Worker (`env.API`); absent until the api is deployed and bound. */
export type ApiBinding = { fetch: (request: Request) => Promise<Response> };

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
  actorId: string,
  log: Logger = logger,
  json?: unknown,
): Promise<ApiAnswer | null> {
  const binding = (env as { API?: ApiBinding } | undefined)?.API;
  if (!binding) return null;
  try {
    // The host is never resolved: a Service Binding routes by binding, not by name.
    const response = await binding.fetch(
      new Request(`https://api.internal${path}`, {
        method: 'POST',
        headers: {
          'x-actor-id': actorId,
          ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(json === undefined ? {} : { body: JSON.stringify(json) }),
        signal: AbortSignal.timeout(25_000),
      }),
    );
    return { ok: response.ok, status: response.status, body: await response.json() };
  } catch (error) {
    log.warn('api call failed', { code: 'api_call_failed', path, error });
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
    log.warn('api call refused', { code: 'api_call_refused', path, status: answer.status });
    return null;
  }
  return answer.body as T;
}
