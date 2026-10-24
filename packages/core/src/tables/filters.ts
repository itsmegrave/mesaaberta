import { z } from 'zod';

// Catalog slugs: lower case, digits and dashes (see `slugify`).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The filters of `/tables`, all in the query string of a plain GET form, a key repeated for each
 * value ticked. GET filters are read directly from the URL; no client form state is needed.
 */
export const tableFilterSchema = z.object({
  system: z.array(z.string().max(80)).default([]),
  modality: z.string().max(20).default(''),
  platform: z.array(z.string().max(80)).default([]),
  tag: z.array(z.string().max(80)).default([]),
});

export type TableFilters = {
  systems: string[];
  modality: 'online' | 'in_person' | null;
  platforms: string[];
  tags: string[];
};

const slugsOf = (list: string[]) => list.filter((value) => SLUG.test(value));

/**
 * The filters in a `/tables` address. A link can say anything, so what is not a filter the page
 * knows (a blank or malformed slug, an unknown modality) is dropped rather than refused: the list
 * still shows, just without that filter.
 */
export async function readTableFilters(url: URL): Promise<TableFilters> {
  const pick = (name: 'system' | 'platform' | 'tag') =>
    url.searchParams
      .getAll(name)
      .filter((value) => tableFilterSchema.shape[name].unwrap().element.safeParse(value).success);
  const data = {
    system: pick('system'),
    platform: pick('platform'),
    tag: pick('tag'),
    modality:
      tableFilterSchema.shape.modality.safeParse(url.searchParams.get('modality') ?? '').data ?? '',
  };
  return {
    systems: slugsOf(data.system),
    modality: data.modality === 'online' || data.modality === 'in_person' ? data.modality : null,
    platforms: slugsOf(data.platform),
    tags: slugsOf(data.tag),
  };
}
