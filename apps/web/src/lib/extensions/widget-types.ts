import type { Component } from 'svelte';
import type { WidgetPayload } from '@mesaaberta/core/server/extensions/contract';

// Kept out of `panels.ts`, which a private build replaces whole: these types stay the same there.

/** What a widget's component is given (see `ExtensionWidgets` and `/<ext>/w/<id>`). */
export type WidgetProps = {
  widget: WidgetPayload;
  /** Where its form posts an answer (a SvelteKit action of `/<ext>/w/<id>`). */
  action: string;
  /** The page it is on, for a form sent without JavaScript to come back to. */
  next: string;
  /**
   * Floating in a corner of a page (a poll), a dialog over the page (a popup, whose component draws
   * the dialog), or alone on its own page (a poll's public results).
   */
  mode: 'card' | 'modal' | 'page';
  /** The widget after an answer, or null once it has nothing more to show. */
  onAnswer: (widget: WidgetPayload | null) => void;
};
export type WidgetComponent = Component<WidgetProps>;
