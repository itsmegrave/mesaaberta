import type { Component } from 'svelte';

/**
 * The admin panel of each extension that has one, by extension id, loaded when its page opens. The
 * web half of `@mesaaberta/core/server/extensions/installed`: a private build replaces this one
 * file to add its own, and nothing else in the public code names a panel. A panel lives in the
 * private package, which reaches the web app's components through the `#lib` alias. None is
 * installed here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- every panel takes the page's data, whatever its extension loads
export type Panel = Component<{ data: any }>;

export const panels: Readonly<Record<string, () => Promise<{ default: Panel }>>> = {};
