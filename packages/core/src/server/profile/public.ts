import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  gameTables,
  profiles,
  profileSocialLinks,
  registrations,
} from '@mesaaberta/core/server/db/schema';
import { bannerUrl, pictureOf, imageUrl } from '@mesaaberta/core/server/images';
import { badgeProgress, heldBadges } from '@mesaaberta/core/server/badges/reads';
import { gmRatingOf } from '@mesaaberta/core/server/ratings/service';
import { participantRatingOf } from '@mesaaberta/core/server/ratings/players';
import { listUpcomingTablesByGm } from '@mesaaberta/core/server/tables/queries';
import { isNetwork, socialTarget } from '../../profile/social-links';
import { normalizeUsername, usernameProblem } from '../../profile/username';

export const PUBLIC_PROFILE_PAGE_SIZE = 12;

/**
 * The "Mesas jogadas" total of these people: concluded tables where they had a confirmed seat (and
 * were not the GM), each once. Everyone asked for is in the map, with 0 when they played none.
 */
export async function tablesPlayed(db: AnyDb, profileIds: string[]): Promise<Map<string, number>> {
  const wanted = [...new Set(profileIds)];
  const found = new Map(wanted.map((id) => [id, 0]));
  if (wanted.length === 0) return found;
  const rows = await db
    .select({ playerId: registrations.playerId, count: sql<number>`count(*)::int` })
    .from(registrations)
    .innerJoin(gameTables, eq(registrations.tableId, gameTables.id))
    .where(
      and(
        inArray(registrations.playerId, wanted),
        eq(registrations.status, 'confirmed'),
        ne(gameTables.gmId, registrations.playerId),
        eq(gameTables.status, 'concluded'),
      ),
    )
    .groupBy(registrations.playerId);
  for (const row of rows) found.set(row.playerId, row.count);
  return found;
}

/** Public totals describe concluded tables, once each; they never expose a player's history. */
async function tableCounts(db: AnyDb, profileId: string) {
  const [played, [hosted]] = await Promise.all([
    tablesPlayed(db, [profileId]),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameTables)
      .where(and(eq(gameTables.gmId, profileId), eq(gameTables.status, 'concluded'))),
  ]);
  return { played: played.get(profileId)!, hosted: hosted.count };
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
    showBadges,
    showParticipantRating,
  }: {
    page?: number;
    now?: Date;
    supabaseUrl?: string;
    viewerId?: string | null;
    /** Whether this profile shows its badges (the `use_badges` rollout). Omitted: it does not. */
    showBadges?: (profile: { id: string; isAdmin: boolean }) => Promise<boolean>;
    /** Whether this profile shows its score as a participant (`use_player_ratings`). Omitted: no. */
    showParticipantRating?: (profile: { id: string; isAdmin: boolean }) => Promise<boolean>;
  } = {},
) {
  if (usernameProblem(username) !== null) return null;
  const [found] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      bannerPath: profiles.bannerPath,
      bio: profiles.bio,
      role: profiles.role,
    })
    .from(profiles)
    .where(and(eq(profiles.username, normalizeUsername(username)), eq(profiles.status, 'active')))
    .limit(1);
  if (!found) return null;

  const [links, totals, rating, upcoming] = await Promise.all([
    db
      .select({
        network: profileSocialLinks.network,
        handle: profileSocialLinks.handle,
        url: profileSocialLinks.url,
      })
      .from(profileSocialLinks)
      .where(eq(profileSocialLinks.profileId, found.id))
      .orderBy(asc(profileSocialLinks.position), asc(profileSocialLinks.id)),
    tableCounts(db, found.id),
    gmRatingOf(db, found.id),
    listUpcomingTablesByGm(db, found.id, now, page, PUBLIC_PROFILE_PAGE_SIZE),
  ]);

  // Null: the rollout has not reached this profile, so the page shows no strip at all.
  const isOwnerView = viewerId === found.id;
  const badges = (await showBadges?.({ id: found.id, isAdmin: found.role === 'admin' }))
    ? await heldBadges(db, found.id, { includeHidden: isOwnerView })
    : null;

  // Null: the rollout has not reached this profile, so its "Mesas jogadas" tile has no score.
  const participantRating = (await showParticipantRating?.({
    id: found.id,
    isAdmin: found.role === 'admin',
  }))
    ? await participantRatingOf(db, found.id, now)
    : null;

  return {
    badges,
    // What the owner has yet to earn, for their own view only.
    badgeProgress: badges && isOwnerView ? await badgeProgress(db, found.id) : null,
    profile: {
      username: found.username!,
      avatarUrl: pictureOf(supabaseUrl, found),
      bannerUrl: bannerUrl(supabaseUrl, found.bannerPath),
      // Plain text in the person's own words; the page keeps its line breaks and escapes it.
      bio: found.bio,
      // `text` is shown next to the icon; `href` is null where there is nothing to open (Discord).
      links: links.flatMap((link) => {
        if (!isNetwork(link.network)) return [];
        const target = socialTarget({ ...link, network: link.network });
        return target ? [{ network: link.network, ...target }] : [];
      }),
      totals,
      rating,
      participantRating,
    },
    tables: upcoming.tables.map((table) => ({
      slug: table.slug,
      title: table.title,
      kind: table.kind,
      system: table.system,
      gmName: table.gmName,
      seatsLeft: table.seatsLeft,
      taken: table.taken,
      reserved: table.reserved,
      capacity: table.capacity,
      timezone: table.timezone,
      startsAt: table.startsAt,
      imageUrl: imageUrl(supabaseUrl, table.imagePath),
      modality: table.modality,
      locationArea: table.locationArea,
      platforms: table.platforms,
      tags: table.tags,
      gmRating: table.gmRating,
    })),
    page,
    pages: Math.max(1, Math.ceil(upcoming.total / PUBLIC_PROFILE_PAGE_SIZE)),
    total: upcoming.total,
    // This per-request action flag is never stored in a shared public Query cache.
    isOwner: viewerId === found.id,
  };
}
