import type { BuildInfo } from '@mesaaberta/core/server/build-info';
import type { DatabaseHealth } from '@mesaaberta/core/server/db/health';
import type { WorkerHealth } from '@mesaaberta/core/server/events/heartbeat';
import type { ApiBinding } from './api-client';

export type ApiHealth =
  ({ status: 'ok'; latencyMs: number } & BuildInfo) | { status: 'down' | 'unbound' };

/** What the api reports about the database and the background Worker; `unknown` when it can't. */
export type StoreHealth = { database: DatabaseHealth | 'unknown'; worker?: WorkerHealth };

/** One try, short: it runs on every uptime probe, and a slow api must not slow /healthz down. */
export const API_PROBE_TIMEOUT_MS = 1000;

/**
 * Asks the api Worker's `/healthz?deep=1` which build it runs and how the database and the
 * background Worker are, over the Service Binding (or, self-hosted, its private address).
 * `unbound` without either, as locally and in the tests; `down` on an error, a refusal or the
 * timeout, and then the database is `unknown`. Never throws.
 */
export async function probeApi(
  env: App.Locals['env'],
  now = () => Date.now(),
): Promise<{ api: ApiHealth; store: StoreHealth }> {
  const settings = env as
    { API?: ApiBinding; API_URL?: string; API_INTERNAL_TOKEN?: string } | undefined;
  const binding = settings?.API;
  const remote = !binding && settings?.API_URL && settings.API_INTERNAL_TOKEN ? settings : null;
  const unknown: StoreHealth = { database: 'unknown' };
  if (!binding && !remote) return { api: { status: 'unbound' }, store: unknown };

  const started = now();
  try {
    const send = binding ? binding.fetch.bind(binding) : (request: Request) => fetch(request);
    const origin = binding ? 'https://api.internal' : remote!.API_URL!.replace(/\/$/, '');
    const response = await send(
      new Request(`${origin}/healthz?deep=1`, {
        headers: remote ? { 'x-internal-token': remote.API_INTERNAL_TOKEN! } : {},
        signal: AbortSignal.timeout(API_PROBE_TIMEOUT_MS),
      }),
    );
    if (!response.ok) return { api: { status: 'down' }, store: unknown };
    const body = (await response.json()) as Partial<BuildInfo & StoreHealth> & { status?: string };
    if (body.status !== 'ok') return { api: { status: 'down' }, store: unknown };
    return {
      api: {
        status: 'ok',
        version: body.version ?? null,
        revision: body.revision ?? null,
        latencyMs: now() - started,
      },
      store: {
        database: body.database ?? 'unknown',
        ...(body.worker ? { worker: body.worker } : {}),
      },
    };
  } catch {
    return { api: { status: 'down' }, store: unknown };
  }
}
