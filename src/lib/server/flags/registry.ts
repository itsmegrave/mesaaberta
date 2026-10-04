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
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flagDefaults;

/**
 * Flags that take the site away rather than show hidden work. The local preview mode, which turns
 * every flag on, leaves these off: it should never lock the developer out.
 */
export const killSwitches: ReadonlySet<FlagName> = new Set(['maintenance_mode']);

export const isFlagName = (name: string): name is FlagName => Object.hasOwn(flagDefaults, name);
