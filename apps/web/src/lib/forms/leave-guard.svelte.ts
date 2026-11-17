import { SvelteSet } from 'svelte/reactivity';

/**
 * The question a form with unsaved changes asks before the page is left. Pass `confirmLeave` as
 * the shared draft guard: it opens the dialog in the root layout (`UnsavedChangesDialog`)
 * and resolves with the answer, true to leave. Closing the tab or reloading still gets the
 * browser's own prompt, which no page can restyle, except the reload `reloadPage` asks about.
 */
export const leaveGuard = $state<{ pending: ((leave: boolean) => void) | null }>({
  pending: null,
});

export function confirmLeave(): Promise<boolean> {
  // A second question while one is open answers the first one "stay".
  leaveGuard.pending?.(false);
  return new Promise((resolve) => {
    leaveGuard.pending = (leave) => {
      leaveGuard.pending = null;
      resolve(leave);
    };
  });
}

// The drafts on screen, each answering whether it holds unsaved changes (`guardDraft` adds them).
const drafts = new SvelteSet<() => boolean>();
let reloading = false;

/** Adds a draft to the ones `reloadPage` asks about. Returns the call that takes it out. */
export function trackDraft(unsaved: () => boolean): () => void {
  drafts.add(unsaved);
  return () => drafts.delete(unsaved);
}

/** True once `reloadPage` has asked, so a draft's `beforeunload` does not ask a second time. */
export const reloadAllowed = () => reloading;

/**
 * Reloads this page at the same address (the "new version" refresh). A draft with unsaved changes
 * asks first in the shared dialog, instead of the browser's own prompt; staying keeps everything
 * as it is. Resolves false when the person stays.
 */
export async function reloadPage(reload = () => location.reload()): Promise<boolean> {
  if ([...drafts].some((unsaved) => unsaved()) && !(await confirmLeave())) return false;
  reloading = true;
  reload();
  return true;
}
