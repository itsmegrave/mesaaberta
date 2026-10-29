import type { SelectItem } from '#lib/components/ui/select.svelte.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { readFromApi } from '../api-read';

/**
 * Whether the place tags catalog is on for the person reading (`use_place_tags`): the whole
 * catalog and suggestions in the form, one "Tags" section on a place's page and the Tags filter.
 * Off, all of them stay at the six old Comodidades.
 */
export async function placeTagsEnabled(
  locals: Pick<App.Locals, 'flags' | 'getProfile'>,
): Promise<boolean> {
  const profile = await locals.getProfile();
  return locals.flags.isEnabled(
    'use_place_tags',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

/**
 * What the place form's Tags offer the person (`profileId`): the catalog, or only the old
 * Comodidades while `use_place_tags` is off, plus the tags the place already `has` (one an admin
 * took out of the list, or another person's suggestion waiting, stays pickable on its own place).
 */
export async function placeTagOptions(
  locals: App.Locals,
  profileId: string,
  has: readonly SelectItem[] = [],
): Promise<{ catalog: boolean; tagOptions: SelectItem[] }> {
  const catalog = await placeTagsEnabled(locals);
  const offered = await readFromApi<SelectItem[]>(
    locals,
    profileId,
    `/v1/places/tag-options${catalog ? '' : '?legacy=1'}`,
  );
  const known = new Set(offered.map((option) => option.slug));
  return { catalog, tagOptions: [...offered, ...has.filter((tag) => !known.has(tag.slug))] };
}
