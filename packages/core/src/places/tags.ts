import { slugify } from '../slug';
import { orderedAmenities, type PlaceKind } from './types';

export type PlaceTagKind = 'state' | 'city' | 'neighbourhood' | 'kind' | 'amenity';
export type PlaceTag = { kind: PlaceTagKind; label: string; slug: string };

/** What a place's tags are made from: its address as the CEP resolved it, its kind and amenities. */
export type TaggedPlace = {
  state: string;
  city: string;
  neighbourhood: string | null;
  kind: PlaceKind;
  amenities: readonly string[];
};

/**
 * A place's tags, rebuilt from its own fields each time it is approved, so they never drift from the
 * address: its state (`pe`), city (`pe-recife`) and neighbourhood (`pe-recife-boa-viagem`), each slug
 * carrying the ones above it so two cities' "Centro" never share a tag; its kind; and each amenity.
 * The location tags keep the name as written; the kind and amenity ones keep the slug, which the
 * page names from the messages.
 */
export function placeTags({
  state,
  city,
  neighbourhood,
  kind,
  amenities,
}: TaggedPlace): PlaceTag[] {
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
    ...orderedAmenities(amenities).map((amenity) => ({
      kind: 'amenity' as const,
      label: amenity,
      slug: amenity.replaceAll('_', '-'),
    })),
  ];
}
