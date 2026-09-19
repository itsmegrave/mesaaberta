/**
 * Every feature flag the app knows about, with the value used when GrowthBook cannot answer
 * (unreachable, slow, or the flag not created yet). Defaults keep unfinished work hidden, so
 * new flags default to `false`. Create a feature with the same key in GrowthBook.
 */
export const flagDefaults = {
	// Off: `/` shows the landing page. On: the released platform.
	is_platform_released: false
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flagDefaults;
