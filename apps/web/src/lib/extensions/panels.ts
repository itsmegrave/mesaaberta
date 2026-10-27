import type { Component } from 'svelte';
import type { BadgePresentation } from './badge-types.js';
import type { WidgetComponent } from './widget-types.js';

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

/**
 * The component of each widget kind (`WidgetPayload.kind`), loaded when one is shown. The other web
 * half of the seam, like `panels`: the public build has none, so no page asks for widgets.
 */
export const widgets: Readonly<Record<string, () => Promise<{ default: WidgetComponent }>>> = {};

/**
 * Lines the footer adds under its community sentence, each with an optional link: a private build
 * names its own people and projects here. None in the public build.
 */
export interface FooterNote {
  text: string;
  link?: { label: string; href: `https://${string}` };
}

export const footerNotes: readonly FooterNote[] = [];

/**
 * How each extension badge (`Extension.badges`) looks and reads, by badge id, like the public
 * `BADGE_PRESENTATION`. A badge missing here is not shown. None in the public build.
 */
export const badges: Readonly<Record<string, BadgePresentation>> = {};
