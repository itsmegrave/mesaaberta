import { slugify } from '../slug';
import type { PlaceKind } from './types';

export type PlaceTagKind = 'state' | 'city' | 'neighbourhood' | 'kind' | 'amenity' | 'feature';
export type PlaceTag = { kind: PlaceTagKind; label: string; slug: string };

/**
 * What a place's tags are made from: its address as the CEP resolved it, its kind and the approved
 * catalog entries it picked (`place_features`), in the order picked.
 */
export type TaggedPlace = {
  state: string;
  city: string;
  neighbourhood: string | null;
  kind: PlaceKind;
  features: readonly { name: string; slug: string }[];
};

/**
 * A place's tags, rebuilt from its own fields each time it is approved, so they never drift from the
 * address: its state (`pe`), city (`pe-recife`) and neighbourhood (`pe-recife-boa-viagem`), each slug
 * carrying the ones above it so two cities' "Centro" never share a tag; its kind; and each catalog
 * entry it picked. The location tags keep the name as written and the catalog ones the entry's name;
 * the kind one keeps the slug, which the page names from the messages.
 */
export function placeTags({ state, city, neighbourhood, kind, features }: TaggedPlace): PlaceTag[] {
  const stateSlug = state.toLowerCase();
  const citySlug = `${stateSlug}-${slugify(city, { fallback: 'cidade' })}`;
  return [
    { kind: 'state', label: state, slug: stateSlug },
    { kind: 'city', label: city, slug: citySlug },
    ...(neighbourhood
      ? [
          {
            kind: 'neighbourhood' as const,
            label: neighbourhood,
            slug: `${citySlug}-${slugify(neighbourhood, { fallback: 'bairro' })}`,
          },
        ]
      : []),
    { kind: 'kind', label: kind, slug: kind.replaceAll('_', '-') },
    ...features.map((feature) => ({
      kind: 'feature' as const,
      label: feature.name,
      slug: feature.slug,
    })),
  ];
}
