import { error } from '@sveltejs/kit';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { callApiRaw, routeTemplate } from './api-client';
import { refusalOf } from './api-write';

/**
 * New features are API-owned. An unavailable API is a service failure, never a local write. A null
 * actor calls as a visitor (no actor header), for the reads anyone may see.
 */
export async function requireApi<T = Record<string, unknown>>(
  locals: App.Locals,
  actor: Pick<Actor, 'id'> | null,
  path: string,
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, unknown> } = {},
): Promise<T> {
  const answer = await callApiRaw(
    locals.env,
    path,
    actor?.id ?? null,
    locals.log,
    options.body,
    {},
    options.method ?? 'GET',
  );
  if (!answer) error(503, 'API unavailable');
  if (answer.ok) return answer.body as T;
  const refusal = refusalOf(answer.status, (answer.body ?? {}) as Record<string, unknown>);
  if (refusal) throw refusal;
  const reason = (answer.body as { error?: unknown } | null)?.error;
  locals.log.warn('api answered with a failure', {
    code: 'api_call_failed',
    route: routeTemplate(path),
    status: answer.status,
    reason: typeof reason === 'string' ? reason : undefined,
  });
  error(503, 'API unavailable');
}

export async function requireApiWrite(
  locals: App.Locals,
  actor: Actor,
  path: string,
  body: Record<string, unknown>,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<{ eventIds: string[]; body: Record<string, unknown> }> {
  const result = await requireApi(locals, actor, path, { method, body });
  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray(result.eventIds) ||
    !result.eventIds.every((id) => typeof id === 'string')
  )
    error(503, 'Invalid API response');
  return { eventIds: result.eventIds as string[], body: result };
}
