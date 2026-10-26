import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profileFavoriteSystems, profiles, systems } from '../db/schema';
import { Invalid } from '../errors';
import { recordEvent } from '../events/outbox';
import { FAVORITE_SYSTEMS_MAX, type FavoriteSystemsInput } from '../../profile/favorite-systems';

export type FavoriteSystem = { name: string; slug: string };

/** A person's favorite systems, in the catalog's order (most played first). Approved ones only. */
export async function readFavoriteSystems(db: AnyDb, profileId: string): Promise<FavoriteSystem[]> {
  return db
    .select({ name: systems.name, slug: systems.slug })
    .from(profileFavoriteSystems)
    .innerJoin(systems, eq(profileFavoriteSystems.systemId, systems.id))
    .where(and(eq(profileFavoriteSystems.profileId, profileId), eq(systems.status, 'approved')))
    .orderBy(asc(systems.position), asc(systems.name));
}

/**
 * Replaces a person's favorite systems and the switch that shows them on the public profile. Every
 * slug must name an approved system, and there are at most FAVORITE_SYSTEMS_MAX: anything else
 * throws `Invalid('systems')` and nothing is saved. Records `FavoriteSystemsChanged`.
 */
export async function setFavoriteSystems(
  db: AnyDb,
  profileId: string,
  input: FavoriteSystemsInput,
): Promise<{ eventIds: string[] }> {
  const slugs = [...new Set(input.systems)];
  if (slugs.length > FAVORITE_SYSTEMS_MAX) throw new Invalid('systems', 'too_many');

  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const found =
      slugs.length === 0
        ? []
        : await t
            .select({ id: systems.id })
            .from(systems)
            .where(and(inArray(systems.slug, slugs), eq(systems.status, 'approved')));
    if (found.length !== slugs.length) throw new Invalid('systems', 'unknown');

    await t.delete(profileFavoriteSystems).where(eq(profileFavoriteSystems.profileId, profileId));
    if (found.length > 0) {
      await t
        .insert(profileFavoriteSystems)
        .values(found.map(({ id }) => ({ profileId, systemId: id })));
    }
    await t
      .update(profiles)
      .set({ showFavoriteSystems: input.show })
      .where(eq(profiles.id, profileId));

    const eventId = await recordEvent(t, {
      type: 'FavoriteSystemsChanged',
      actorId: profileId,
      payload: { systemIds: found.map(({ id }) => id) },
    });
    return { eventIds: [eventId] };
  });
}
