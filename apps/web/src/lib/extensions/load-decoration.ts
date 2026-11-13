import type { Component } from 'svelte';
import { decorations } from './panels.js';

/** Whether this build has any decoration component, so a page without one never asks. */
export const decorates = () => Object.keys(decorations).length > 0;

/**
 * The component of a decoration kind, or null when this build has none for it. Loaded in the
 * browser only (decorations are drawn after the page loads); a failure is reported and nothing is
 * drawn.
 */
export async function loadDecoration<P extends Record<string, unknown>>(
  kind: string,
): Promise<Component<P> | null> {
  const load = Object.hasOwn(decorations, kind) ? decorations[kind] : undefined;
  if (!load) return null;
  try {
    return (await load()).default as unknown as Component<P>;
  } catch (failure) {
    console.error('extension.load_failed', { resourceType: 'decoration', resourceId: kind });
    // Imported only on a failure: the SDK reads `$app/state`, which isolated component tests mock.
    // `@sentry/core`, not the SDK: a dynamic import keeps every export, Replay and Feedback included.
    const Sentry = await import('@sentry/core');
    Sentry.captureException(failure, { tags: { resourceType: 'decoration', resourceId: kind } });
    return null;
  }
}
