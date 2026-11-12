import type { AnalyticsEvent, AnalyticsProvider, AnalyticsProviderFactory } from './provider';

export type AnalyticsEnv = {
  MIXPANEL_TOKEN?: string;
  MIXPANEL_REGION?: string;
};

const HOSTS: Record<string, string> = {
  US: 'api.mixpanel.com',
  EU: 'api-eu.mixpanel.com',
  IN: 'api-in.mixpanel.com',
};

/** Mixpanel's Import API record for one event. */
export function mixpanelRecord(event: AnalyticsEvent) {
  return {
    event: event.name,
    properties: {
      distinct_id: event.distinctId,
      $insert_id: event.insertId,
      time: Math.floor(event.time.getTime() / 1000),
      ...event.properties,
    },
  };
}

/** Mixpanel's Engage API record that sets fixed labels on a person's profile (`$set`). */
export function mixpanelProfileUpdate(
  token: string,
  distinctId: string,
  properties: Record<string, string>,
) {
  // `$ip: 0` keeps Mixpanel from geolocating the profile from the Worker's address.
  return { $token: token, $distinct_id: distinctId, $ip: 0, $set: properties };
}

/** Mixpanel adapter. The Import API allows delayed outbox retries and deduplicates on `$insert_id`. */
export function mixpanelProvider(
  env: AnalyticsEnv | undefined,
  send: typeof fetch = fetch,
): AnalyticsProvider | null {
  if (!env?.MIXPANEL_TOKEN) return null;
  const token = env.MIXPANEL_TOKEN;
  const host = HOSTS[env.MIXPANEL_REGION ?? 'US'];
  if (!host) throw new Error('Invalid Mixpanel region');
  return {
    name: 'mixpanel',
    async send(event) {
      const response = await send(`https://${host}/import?strict=1`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Basic ${btoa(`${token}:`)}`,
        },
        body: JSON.stringify([mixpanelRecord(event)]),
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
    async setProfile(distinctId, properties) {
      const response = await send(`https://${host}/engage?verbose=1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([mixpanelProfileUpdate(token, distinctId, properties)]),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        throw Object.assign(new Error(`Mixpanel profile update failed: HTTP ${response.status}`), {
          code: `MIXPANEL_HTTP_${response.status}`,
        });
      const result = (await response.json()) as { status?: number };
      if (result.status !== 1) throw new Error('Mixpanel profile update rejected');
    },
  };
}

export const mixpanelFactory: AnalyticsProviderFactory<AnalyticsEnv> = (env) =>
  mixpanelProvider(env);
