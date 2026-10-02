import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, profileSocialLinks, registrations } from '../db/schema';
import { pictureOf, imageUrl } from '../images';
import { gmRating } from '../ratings/service';
import { listUpcomingTablesByGm } from '../tables/queries';
import { isNetwork, parseSocialUrl } from '$lib/profile/social-links';
import { normalizeUsername, usernameProblem } from '$lib/profile/username';

export const PUBLIC_PROFILE_PAGE_SIZE = 12;

/** Public totals describe concluded tables, once each; they never expose a player's history. */
async function tableCounts(db: AnyDb, profileId: string) {
  const [played, hosted] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrations)
      .innerJoin(gameTables, eq(registrations.tableId, gameTables.id))
      .where(
        and(
          eq(registrations.playerId, profileId),
          eq(registrations.status, 'confirmed'),
          ne(gameTables.gmId, profileId),
          eq(gameTables.status, 'concluded'),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameTables)
      .where(and(eq(gameTables.gmId, profileId), eq(gameTables.status, 'concluded'))),
  ]);
  return { played: played[0].count, hosted: hosted[0].count };
}

/** Allowlisted public projection. Neither a full profile nor registrations leave this module. */
export async function publicProfile(
  db: AnyDb,
  username: string,
  {
    page = 1,
    now = new Date(),
    supabaseUrl,
    viewerId = null,
  }: {
    page?: number;
    now?: Date;
    supabaseUrl?: string;
    viewerId?: string | null;
  } = {},
) {
  if (usernameProblem(username) !== null) return null;
  const [found] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(and(eq(profiles.username, normalizeUsername(username)), eq(profiles.status, 'active')))
    .limit(1);
  if (!found) return null;

  const [links, totals, rating, upcoming] = await Promise.all([
    db
      .select({ network: profileSocialLinks.network, url: profileSocialLinks.url })
      .from(profileSocialLinks)
      .where(eq(profileSocialLinks.profileId, found.id))
      .orderBy(asc(profileSocialLinks.position), asc(profileSocialLinks.id)),
    tableCounts(db, found.id),
    gmRating(db, found.id),
    listUpcomingTablesByGm(db, found.id, now, page, PUBLIC_PROFILE_PAGE_SIZE),
  ]);

  return {
    profile: {
      username: found.username!,
      avatarUrl: pictureOf(supabaseUrl, found),
      links: links.flatMap(({ network, url }) => {
        const safe = parseSocialUrl(url);
        return isNetwork(network) && safe ? [{ network, url: safe }] : [];
      }),
      totals,
      rating,
    },
    tables: upcoming.tables.map((table) => ({
      slug: table.slug,
      title: table.title,
      kind: table.kind,
      system: table.system,
      gmName: table.gmName,
      seatsLeft: table.seatsLeft,
      capacity: table.capacity,
      timezone: table.timezone,
      nextAt: table.nextAt,
      imageUrl: imageUrl(supabaseUrl, table.imagePath),
      modality: table.modality,
      locationArea: table.locationArea,
      platforms: table.platforms,
      tags: table.tags,
    })),
    page,
    pages: Math.max(1, Math.ceil(upcoming.total / PUBLIC_PROFILE_PAGE_SIZE)),
    total: upcoming.total,
    // This per-request action flag is never stored in a shared public Query cache.
    isOwner: viewerId === found.id,
  };
}
