import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const THEMES = ['classic', 'overdrive'] as const;
const CHOICES = ['system', 'light', 'dark'] as const;
const MODES = ['light', 'dark'] as const;

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

/**
 * The browser says which theme is on screen: `in_use` at most once a day, `changed` after a press
 * of the Overdrive pedal or the light/dark switch. The theme lives in localStorage, so this is how
 * Mixpanel learns it: an event (`theme_in_use`, `theme_changed`) and the same three labels on the
 * person's profile, so every other event can be broken down by them. Signed-in people only, like
 * all tracking; anyone else gets a 204 and nothing is sent.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null) error(400, 'Invalid theme report');
  const { kind, theme, theme_choice, theme_mode } = body as Record<string, unknown>;
  if (
    !oneOf(['in_use', 'changed'] as const, kind) ||
    !oneOf(THEMES, theme) ||
    !oneOf(CHOICES, theme_choice) ||
    !oneOf(MODES, theme_mode)
  )
    error(400, 'Invalid theme report');

  const user = await locals.getUser();
  const labels = { theme, theme_choice, theme_mode };
  locals.track(kind === 'in_use' ? 'theme_in_use' : 'theme_changed', user?.id, labels, {
    profile: labels,
  });
  return new Response(null, { status: 204, headers: { 'cache-control': 'private, no-store' } });
};
