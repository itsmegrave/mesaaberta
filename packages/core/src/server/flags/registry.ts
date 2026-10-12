/**
 * Every feature flag the app knows about, with the value used when GrowthBook cannot answer
 * (unreachable, slow, or the flag not created yet). Defaults keep unfinished work hidden, so
 * new flags default to `false`. Create a feature with the same key in GrowthBook.
 */
export const flagDefaults = {
  // Off: the site as usual. On: every visitor gets the maintenance screen; admins still get through.
  maintenance_mode: false,
  // Off: text and QR artwork. On: include the table photo as its background.
  use_table_image: false,
  // Off: an event's lease is a time only (today's dispatcher). On: each claim carries a token and
  // every update is conditional on it, so a dispatcher whose lease expired cannot finish or release
  // the new claim (ADR 0003). Target admins first: `isAdmin = true`.
  api_events_fenced_leases: false,
  // Off: nothing is published. On: after an event commits its reference (id, type, version) is sent
  // to the `domain-events-canary` queue, whose consumer only counts it (ADR 0003, stage 2). Needs the
  // DOMAIN_EVENTS queue binding; without it this flag does nothing. Target admins first.
  api_events_queue_shadow: false,
  // Off: the analytics handlers run with every other handler, right after the event commits. On:
  // the request leaves them pending and publishes the event's reference, and the queue consumer on
  // the background Worker runs them (ADR 0003, stage 3). The consumer only does so when its
  // QUEUE_LIVE_HANDLERS variable names them; until then the sweeper runs them within five minutes.
  // Needs the DOMAIN_EVENTS queue binding. Target admins first.
  api_events_queue_analytics: false,
  // Off: the admin event actions ("Rodar agora", "Rodar todos os que falharam") run in the web
  // Worker. On: they call the api Worker over the Service Binding and fall back to the web path when
  // the api cannot be reached. Needs the API binding; without it this flag does nothing.
  api_admin_events: false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flagDefaults;

/**
 * Flags that take the site away rather than show hidden work. The local preview mode, which turns
 * every flag on, leaves these off: it should never lock the developer out.
 */
export const killSwitches: ReadonlySet<FlagName> = new Set(['maintenance_mode']);

export const isFlagName = (name: string): name is FlagName => Object.hasOwn(flagDefaults, name);
