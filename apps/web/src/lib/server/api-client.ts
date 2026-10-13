import { logger, type Logger } from '@mesaaberta/core/server/logger';

/** The Service Binding to the api Worker (`env.API`); absent until the api is deployed and bound. */
export type ApiBinding = { fetch: (request: Request) => Promise<Response> };

/**
 * Calls the api Worker over its Service Binding as `actorId` (the api checks that person is an
 * admin again). Returns null when the call cannot be made or did not answer with JSON 2xx, so the
 * caller keeps its own path: the web Worker stays the default and the api is the opt-in
 * (Trello #120, strangler). Never throws.
 */
export async function callApi<T>(
  env: App.Locals['env'],
  path: string,
  actorId: string,
  log: Logger = logger,
): Promise<T | null> {
  const binding = (env as { API?: ApiBinding } | undefined)?.API;
  if (!binding) return null;
  try {
    // The host is never resolved: a Service Binding routes by binding, not by name.
    const response = await binding.fetch(
      new Request(`https://api.internal${path}`, {
        method: 'POST',
        headers: { 'x-actor-id': actorId },
        signal: AbortSignal.timeout(25_000),
      }),
    );
    if (!response.ok) {
      log.warn('api call refused', { code: 'api_call_refused', path, status: response.status });
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    log.warn('api call failed', { code: 'api_call_failed', path, error });
    return null;
  }
}
