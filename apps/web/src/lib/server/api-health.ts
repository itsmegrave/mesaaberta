import type { BuildInfo } from '@mesaaberta/core/server/build-info';
import type { ApiBinding } from './api-client';

export type ApiHealth =
  ({ status: 'ok'; latencyMs: number } & BuildInfo) | { status: 'down' | 'unbound' };

/** One try, short: it runs on every uptime probe, and a slow api must not slow /healthz down. */
export const API_PROBE_TIMEOUT_MS = 1000;

/**
 * Asks the api Worker's `/healthz` which build it runs, over the Service Binding (or, self-hosted,
 * its private address). `unbound` without either, as locally and in the tests; `down` on an error,
 * a refusal or the timeout. Never throws.
 */
export async function probeApi(env: App.Locals['env'], now = () => Date.now()): Promise<ApiHealth> {
  const settings = env as
    { API?: ApiBinding; API_URL?: string; API_INTERNAL_TOKEN?: string } | undefined;
  const binding = settings?.API;
  const remote = !binding && settings?.API_URL && settings.API_INTERNAL_TOKEN ? settings : null;
  if (!binding && !remote) return { status: 'unbound' };

  const started = now();
  try {
    const send = binding ? binding.fetch.bind(binding) : (request: Request) => fetch(request);
    const origin = binding ? 'https://api.internal' : remote!.API_URL!.replace(/\/$/, '');
    const response = await send(
      new Request(`${origin}/healthz`, {
        headers: remote ? { 'x-internal-token': remote.API_INTERNAL_TOKEN! } : {},
        signal: AbortSignal.timeout(API_PROBE_TIMEOUT_MS),
      }),
    );
    if (!response.ok) return { status: 'down' };
    const body = (await response.json()) as Partial<BuildInfo> & { status?: string };
    if (body.status !== 'ok') return { status: 'down' };
    return {
      status: 'ok',
      version: body.version ?? null,
      revision: body.revision ?? null,
      latencyMs: now() - started,
    };
  } catch {
    return { status: 'down' };
  }
}
