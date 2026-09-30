import type { EventType, Handler, StoredEvent } from '../events/types';

export type AnalyticsEnv = {
  MIXPANEL_TOKEN?: string;
  MIXPANEL_REGION?: string;
};

export const PRODUCT_EVENTS = [
  'TableCreated',
  'TableUpdated',
  'TableDisabled',
  'JoinRequested',
  'JoinApproved',
  'JoinDeclined',
  'PlayerJoined',
  'PlayerLeft',
  'RatingSubmitted',
] as const satisfies readonly EventType[];

const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function productEvent(event: StoredEvent) {
  if (
    !(PRODUCT_EVENTS as readonly string[]).includes(event.type) ||
    !uuid(event.actorId) ||
    !uuid(event.id)
  )
    return null;
  const tableId = 'tableId' in event.payload ? event.payload.tableId : null;
  return {
    event: event.type,
    properties: {
      distinct_id: event.actorId,
      $insert_id: event.id,
      time: Math.floor(event.createdAt.getTime() / 1000),
      ...(uuid(tableId) && { tableId }),
    },
  };
}

/** Uses the existing outbox for retries and Mixpanel's insert ID for deduplication. */
export function mixpanelHandler(
  env: AnalyticsEnv | undefined,
  send: typeof fetch = fetch,
): Handler | null {
  if (!env?.MIXPANEL_TOKEN) return null;
  const token = env.MIXPANEL_TOKEN;
  const hosts: Record<string, string> = {
    US: 'api.mixpanel.com',
    EU: 'api-eu.mixpanel.com',
    IN: 'api-in.mixpanel.com',
  };
  const host = hosts[env.MIXPANEL_REGION ?? 'US'];
  if (!host) throw new Error('Invalid Mixpanel region');
  return {
    name: 'mixpanel-product-events-v1',
    types: PRODUCT_EVENTS,
    async handle(event) {
      const payload = productEvent(event);
      if (!payload) return;
      const response = await send(`https://${host}/import?strict=1`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Basic ${btoa(`${token}:`)}`,
        },
        body: JSON.stringify([payload]),
        signal: AbortSignal.timeout(5000),
      });
      // Provider response bodies can echo data: never retain them in error messages.
      if (!response.ok)
        throw Object.assign(new Error(`Mixpanel import failed: HTTP ${response.status}`), {
          code: `MIXPANEL_HTTP_${response.status}`,
        });
      const result = (await response.json()) as { num_records_imported?: number; status?: string };
      if (result.num_records_imported !== 1 || result.status !== 'OK')
        throw new Error('Mixpanel import rejected');
    },
  };
}
