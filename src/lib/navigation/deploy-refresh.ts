import type { OnNavigate } from '@sveltejs/kit';

/**
 * After a deploy, the page open in the browser still runs the old build: its next in-app
 * navigation could render stale code or ask for a chunk that is gone. SvelteKit polls for the new
 * version (`version.pollInterval` in vite.config.ts) and sets `updated.current`; this turns the
 * next navigation into a full page load of where the visitor was going, so it lands on the new
 * build without reloading the page under them while they read or type.
 *
 * Call from `onNavigate`: it runs only once every `beforeNavigate` guard (the unsaved changes
 * dialog) has let the navigation through. Returns the pending promise that holds the client-side
 * navigation while the browser loads the page, or nothing when there is no new version.
 */
export function reloadIfUpdated(
  navigation: Pick<OnNavigate, 'to'>,
  updated: boolean,
  load: (href: string) => void = (href) => location.assign(href),
): Promise<never> | undefined {
  const href = navigation.to?.url.href;
  if (!updated || !href) return;
  load(href);
  return new Promise<never>(() => {});
}
