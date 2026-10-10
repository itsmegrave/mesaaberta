/**
 * A product event in a provider-neutral shape. Only opaque ids and non-identifying values belong
 * here: the privacy filter in `product-events.ts` decides what reaches this type.
 */
export type AnalyticsEvent = {
  name: string;
  /** Opaque actor UUID. */
  distinctId: string;
  /** Stable across retries: providers use it to deduplicate. */
  insertId: string;
  /** When the event originally happened, not when it was delivered. */
  time: Date;
  /** Opaque ids, counts and fixed labels only: never names, text or contact details. */
  properties: Record<string, string | number>;
};

/**
 * Where product events go. An adapter translates `AnalyticsEvent` to one vendor's API and throws
 * when delivery was not acknowledged, so the outbox retries it. It must be safe to repeat for the
 * same `insertId`, and must never copy provider response bodies into error messages.
 */
export interface AnalyticsProvider {
  /** Stable lowercase id: the outbox handler is recorded as `<name>-product-events-v1`. */
  readonly name: string;
  send(event: AnalyticsEvent): Promise<void>;
}

/** Builds a provider from the runtime environment, or `null` when it is not configured. */
export type AnalyticsProviderFactory<Env> = (env: Env | undefined) => AnalyticsProvider | null;
