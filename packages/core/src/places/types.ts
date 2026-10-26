/**
 * What an "Onde jogar" place is, from a closed list. The slug is stored (`places.kind`, the
 * `place_kind` enum) and travels in the address (`/places?kind=game_cafe`); the labels are in the
 * messages. Mirror the enum, and add new kinds at the end.
 */
export const PLACE_KINDS = [
  'store',
  'game_cafe',
  'club',
  'bar',
  'cultural_space',
  'other',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const isPlaceKind = (value: unknown): value is PlaceKind =>
  (PLACE_KINDS as readonly unknown[]).includes(value);

/**
 * What a place offers, from a closed list: each one becomes a tag the list filters on. Mirror the
 * `places_amenities_known` check on `places`, and add new ones at the end.
 */
export const PLACE_AMENITIES = [
  'accessible',
  'lends_games',
  'bookable_tables',
  'free_to_play',
  'sells_food',
  'open_late',
] as const;
export type PlaceAmenity = (typeof PLACE_AMENITIES)[number];

export const isPlaceAmenity = (value: unknown): value is PlaceAmenity =>
  (PLACE_AMENITIES as readonly unknown[]).includes(value);

/** The picked amenities in the list's order, each once, so the same pick is stored the same way. */
export const orderedAmenities = (picked: readonly string[]): PlaceAmenity[] =>
  PLACE_AMENITIES.filter((amenity) => picked.includes(amenity));

// Mirror the length checks on `places`.
export const PLACE_LIMITS = {
  name: 80,
  description: 280,
  street: 120,
  complement: 60,
  openingHours: 120,
} as const;

/** At most this many network links on a place, besides the site. */
export const MAX_PLACE_LINKS = 6;
