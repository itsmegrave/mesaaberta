import type { Handler } from '../events/types';
import { mixpanelFactory, type AnalyticsEnv as MixpanelEnv } from './mixpanel';
import { PRODUCT_EVENTS, toAnalyticsEvent } from './product-events';
import type { AnalyticsProvider, AnalyticsProviderFactory } from './provider';

export type { AnalyticsEvent, AnalyticsProvider } from './provider';

/** Every provider's environment. Add a provider's variables here when registering it. */
export type AnalyticsEnv = MixpanelEnv;

/** To add or swap a provider, write an adapter in this folder and list its factory here. */
const FACTORIES: readonly AnalyticsProviderFactory<AnalyticsEnv>[] = [mixpanelFactory];

/** One outbox handler per provider, so each retries and records success independently. */
export function analyticsHandler(provider: AnalyticsProvider): Handler {
  return {
    name: `${provider.name}-product-events-v1`,
    types: PRODUCT_EVENTS,
    async handle(event) {
      const analyticsEvent = toAnalyticsEvent(event);
      if (analyticsEvent) await provider.send(analyticsEvent);
    },
  };
}

/** Handlers for the providers the environment configures; none when analytics is off. */
export function analyticsHandlers(
  env: AnalyticsEnv | undefined,
  factories: readonly AnalyticsProviderFactory<AnalyticsEnv>[] = FACTORIES,
): Handler[] {
  return factories.flatMap((create) => {
    const provider = create(env);
    return provider ? [analyticsHandler(provider)] : [];
  });
}
