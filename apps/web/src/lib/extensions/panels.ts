import type { Component } from 'svelte';
import type { WidgetPayload } from '@mesaaberta/core/server/extensions/contract';

/**
 * The admin panel of each extension that has one, by extension id, loaded when its page opens. The
 * web half of `@mesaaberta/core/server/extensions/installed`: a private build replaces this one
 * file to add its own, and nothing else in the public code names a panel. Instagram's lives in
 * the private package, which reaches the web app's components through the `#lib` alias.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- every panel takes the page's data, whatever its extension loads
export type Panel = Component<{ data: any }>;

export const panels: Readonly<Record<string, () => Promise<{ default: Panel }>>> = {
  // @ts-expect-error -- TypeScript does not resolve a .svelte file through a package export; Vite does
  instagram: () => import('@mesaaberta/privy/instagram/panel'),
};

/** What a widget's component is given (see `ExtensionWidgets` and `/<ext>/w/<id>`). */
export type WidgetProps = {
  widget: WidgetPayload;
  /** Where its form posts an answer (a SvelteKit action of `/<ext>/w/<id>`). */
  action: string;
  /** The page it is on, for a form sent without JavaScript to come back to. */
  next: string;
  /** Floating over a page, or alone on its own page (a poll's public results). */
  mode: 'card' | 'page';
  /** The widget after an answer, or null once it has nothing more to show. */
  onAnswer: (widget: WidgetPayload | null) => void;
};
export type WidgetComponent = Component<WidgetProps>;

/**
 * The component of each widget kind (`WidgetPayload.kind`), loaded when one is shown. The other web
 * half of the seam, like `panels`: the public build has none, so no page asks for widgets.
 */
export const widgets: Readonly<Record<string, () => Promise<{ default: WidgetComponent }>>> = {};
