import type { AnyDb } from '../db/client';
import type { Logger } from '../logger';
import type { AnalyticsEnv } from './index';
import { analyticsProviders } from './index';
import type { AnalyticsProviderFactory } from './provider';

/** Events about what someone did during a request, which no domain event records. */
export type RequestEventName =
  | 'player_browse_mesas_viewed'
  | 'player_mesa_detail_viewed'
  | 'player_seat_claim_initiated'
  | 'gm_onboarding_started';

export type RequestEventProperties = Record<string, string | number>;

/** What to send, or a lookup that runs after the response and may decide there is nothing to send. */
export type RequestEventInput =
  RequestEventProperties | ((db: AnyDb) => Promise<RequestEventProperties | null>);

export type Track = (
  name: RequestEventName,
  distinctId: string | null | undefined,
  properties: RequestEventInput,
) => void;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How someone arrived, from the Referer header alone: no cookie, no stored identity. */
export function sourceChannel(referer: string | null, url: URL): string {
  if (!referer) return 'direct';
  try {
    return new URL(referer).origin === url.origin ? 'internal_link' : 'referral';
  } catch {
    return 'direct';
  }
}

/**
 * Best-effort tracking for signed-in people: it queues the send for after the response, so a slow
 * or failing provider never slows or breaks a page. These events are not retried (they have no
 * outbox row); a failure is logged without the provider's response. Anonymous visitors are not
 * tracked, since there is no opaque id to attach and no cookie to make one.
 */
export function createTracker(options: {
  env: AnalyticsEnv | undefined;
  afterResponse: (task: (db: AnyDb) => Promise<unknown>) => void;
  log: Logger;
  factories?: readonly AnalyticsProviderFactory<AnalyticsEnv>[];
  now?: () => Date;
}): Track {
  const { env, afterResponse, log, factories, now = () => new Date() } = options;
  return (name, distinctId, properties) => {
    if (!distinctId || !UUID.test(distinctId)) return;
    const providers = analyticsProviders(env, factories);
    if (providers.length === 0) return;
    const time = now();
    afterResponse(async (db) => {
      const resolved = typeof properties === 'function' ? await properties(db) : properties;
      if (!resolved) return;
      const event = {
        name,
        distinctId,
        insertId: crypto.randomUUID(),
        time,
        properties: { ...resolved, timestamp_utc: time.toISOString() },
      };
      const results = await Promise.allSettled(providers.map((provider) => provider.send(event)));
      results.forEach((result, index) => {
        if (result.status === 'rejected')
          log.warn('analytics.track.failed', {
            event: name,
            provider: providers[index].name,
            error: result.reason,
          });
      });
    });
  };
}
