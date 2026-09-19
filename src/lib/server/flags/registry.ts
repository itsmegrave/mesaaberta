/**
 * Every feature flag the app knows about, with the value used when GrowthBook cannot answer
 * (unreachable, slow, or the flag not created yet). Defaults keep unfinished work hidden, so
 * new flags default to `false`. Create a feature with the same key in GrowthBook.
 */
export const flagDefaults = {
	// Turns the landing page at `/` into the real home once tables can be opened.
	tables_open: false
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flagDefaults;
