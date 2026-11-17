import { m } from '#lib/paraglide/messages.js';
import { formatCep } from '@mesaaberta/core/location/cep';
import type { IconName } from '#lib/icons/names.js';
import {
  PLACE_AMENITIES,
  PLACE_KINDS,
  isPlaceAmenity,
  isPlaceKind,
  type PlaceAmenity,
  type PlaceKind,
} from '@mesaaberta/core/places/types';

/** Each kind's name, as the card, the page, the form and the filters say it. */
export const placeKindLabels: Record<PlaceKind, () => string> = {
  store: m.place_kind_store,
  game_cafe: m.place_kind_game_cafe,
  club: m.place_kind_club,
  bar: m.place_kind_bar,
  cultural_space: m.place_kind_cultural_space,
  other: m.place_kind_other,
};

/** The drawing a place without a photo shows, by kind. */
export const placeKindIcons: Record<PlaceKind, IconName> = {
  store: 'game-icons:shop',
  game_cafe: 'game-icons:meeple',
  club: 'game-icons:round-table',
  bar: 'game-icons:tavern-sign',
  cultural_space: 'game-icons:house',
  other: 'game-icons:position-marker',
};

export const placeAmenityLabels: Record<PlaceAmenity, () => string> = {
  accessible: m.place_amenity_accessible,
  lends_games: m.place_amenity_lends_games,
  bookable_tables: m.place_amenity_bookable_tables,
  free_to_play: m.place_amenity_free_to_play,
  sells_food: m.place_amenity_sells_food,
  open_late: m.place_amenity_open_late,
};

export const placeKindOptions = () =>
  PLACE_KINDS.map((value) => ({ value, label: placeKindLabels[value]() }));
/**
 * The old Comodidades as catalog tags (their slugs with dashes): all the form and the filter offer
 * while `use_place_tags` is off.
 */
export const legacyTagOptions = () =>
  PLACE_AMENITIES.map((value) => ({
    slug: value.replaceAll('_', '-'),
    name: placeAmenityLabels[value](),
  }));

/** "Boa Viagem, Recife · PE", or "Recife · PE" when the CEP has no neighbourhood. */
export const placeArea = (place: { neighbourhood: string | null; city: string; state: string }) =>
  place.neighbourhood
    ? m.place_area({ neighbourhood: place.neighbourhood, city: place.city, state: place.state })
    : m.place_area_city({ city: place.city, state: place.state });

/**
 * What a tag says: the place's own words for its state, city and neighbourhood, the catalog's name
 * for its tags, the message for its kind and for an amenity tag from before the catalog (those keep
 * the slug).
 */
export function placeTagLabel(tag: { kind: string; label: string }): string {
  if (tag.kind === 'kind' && isPlaceKind(tag.label)) return placeKindLabels[tag.label]();
  if (tag.kind === 'amenity' && isPlaceAmenity(tag.label)) return placeAmenityLabels[tag.label]();
  return tag.label;
}

/**
 * OpenStreetMap searching the address: no embedded map (the CSP keeps third-party tiles out), so
 * "Ver no mapa" opens it apart.
 */
export const placeMapHref = (place: {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(
    `${place.street}, ${place.city} - ${place.state}, ${formatCep(place.postalCode)}`,
  )}`;
