import { viewerSegments } from '@mesaaberta/core/server/audience/segments';
import type { WidgetViewer } from '@mesaaberta/core/server/extensions/contract';

/**
 * The signed-in person as a widget sees them, or null when nothing should be aimed at them (signed
 * out, suspended, still onboarding, or no database). Widgets are never for signed-out visitors.
 */
export async function widgetViewer(locals: App.Locals): Promise<WidgetViewer | null> {
  const profile = await locals.getProfile();
  if (!profile || !locals.db) return null;
  const segments = await viewerSegments(locals.db, profile.id);
  return segments && { id: profile.id, segments };
}
