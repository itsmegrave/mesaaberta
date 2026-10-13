/**
 * The question a form with unsaved changes asks before the page is left. Pass `confirmLeave` as
 * the shared draft guard: it opens the dialog in the root layout (`UnsavedChangesDialog`)
 * and resolves with the answer, true to leave. Closing the tab or reloading still gets the
 * browser's own prompt, which no page can restyle.
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
