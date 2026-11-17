import { PLACE_AMENITIES, type PlaceAmenity } from './types';

/**
 * A place's tags ("Tags" in Onde jogar) come from the `place_features` catalog: what a place has
 * and what is played there. The first six entries are the old Comodidades (`PLACE_AMENITIES`), with
 * their slugs written with dashes, as their tags always were.
 */
export type PlaceFeature = { name: string; slug: string; pending?: true };

/** How many tags one place may pick. */
export const MAX_PLACE_FEATURES = 20;

/** The slugs of the entries that were Comodidades: all the form offers while `use_place_tags` is off. */
export const LEGACY_FEATURE_SLUGS: readonly string[] = PLACE_AMENITIES.map((amenity) =>
  amenity.replaceAll('_', '-'),
);

/** The Comodidades among a place's picks, as `places.amenities` keeps them for older code. */
export const amenitiesOf = (slugs: readonly string[]): PlaceAmenity[] =>
  PLACE_AMENITIES.filter((amenity) => slugs.includes(amenity.replaceAll('_', '-')));

/** The picks an old form sent as Comodidades, as catalog slugs. */
export const featuresOfAmenities = (amenities: readonly string[]): string[] =>
  PLACE_AMENITIES.filter((amenity) => amenities.includes(amenity)).map((amenity) =>
    amenity.replaceAll('_', '-'),
  );
