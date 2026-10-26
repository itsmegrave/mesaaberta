import { z } from 'zod';

z.config({ jitless: true });

/** How many systems a person can mark as favorite. */
export const FAVORITE_SYSTEMS_MAX = 10;

/** How many of the most played systems "Sistemas favoritos" offers as pills, before any search. */
export const FAVORITE_SYSTEMS_SUGGESTED = 12;

/** The "Sistemas favoritos" form: the systems by slug, and whether the public profile shows them. */
export const favoriteSystemsSchema = z.object({
  systems: z.array(z.string().min(1)).max(FAVORITE_SYSTEMS_MAX, 'too_many'),
  show: z.boolean(),
});

export type FavoriteSystemsInput = z.infer<typeof favoriteSystemsSchema>;
