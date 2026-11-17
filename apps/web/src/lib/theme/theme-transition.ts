/** How long the new theme takes to spread over the page, and its curve (an ease-out). */
export const THEME_REVEAL_MS = 400;
export const THEME_REVEAL_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

type Origin = { x: number; y: number };

/** The centre of the control that changed the theme, where the new theme starts to spread from. */
export function originOf(element: Element | null | undefined): Origin | undefined {
  if (!element) return undefined;
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** The radius that reaches the farthest corner of the viewport from `origin`. */
export function revealRadius({ x, y }: Origin, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

/**
 * Runs `change` (which must update the DOM synchronously) so the new theme grows as a circle from
 * `origin` over the old one. It changes in place, with no motion, when there is no origin (the
 * system switched), when the reader asks for reduced motion, or when the browser has no View
 * Transitions. Resolves once the DOM shows the new theme, so callers can move focus.
 */
export function revealTheme(change: () => void, origin?: Origin): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!origin || reduce || typeof document.startViewTransition !== 'function') {
    change();
    return Promise.resolve();
  }

  const root = document.documentElement;
  // layout.css turns off the default cross-fade only while this attribute is set.
  root.dataset.themeReveal = '';
  const transition = document.startViewTransition(change);
  transition.ready
    .then(() => {
      const radius = revealRadius(origin, window.innerWidth, window.innerHeight);
      root.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: THEME_REVEAL_MS,
          easing: THEME_REVEAL_EASING,
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    // A transition skipped (another one started, the tab was hidden) still applied the change.
    .catch(() => {});
  transition.finished.finally(() => delete root.dataset.themeReveal).catch(() => {});
  return transition.updateCallbackDone.catch(() => {});
}
