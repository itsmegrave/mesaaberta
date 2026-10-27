import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  gameTables,
  profiles,
  profileSocialLinks,
  registrations,
} from '@mesaaberta/core/server/db/schema';
import { bannerUrl, pictureOf, imageUrl } from '@mesaaberta/core/server/images';
import { heldBadges } from '@mesaaberta/core/server/badges/reads';
import { gmRatingOf, publicGmReviews } from '@mesaaberta/core/server/ratings/service';
import { participantRatingOf } from '@mesaaberta/core/server/ratings/players';
import { listUpcomingTablesByGm } from '@mesaaberta/core/server/tables/queries';
import { readFavoriteSystems } from '@mesaaberta/core/server/profile/favorite-systems';
import { followerCount, isFollowing } from '@mesaaberta/core/server/follows/service';
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
    showFavoriteSystems,
    showTableRole = false,
    withFollows = false,
  }: {
    page?: number;
    now?: Date;
    supabaseUrl?: string;
    viewerId?: string | null;
    /** Whether this profile shows its badges (the `use_badges` rollout). Omitted: it does not. */
    showBadges?: (profile: { id: string; isAdmin: boolean }) => Promise<boolean>;
    /** Whether this profile shows its score as a participant (`use_player_ratings`). Omitted: no. */
    showParticipantRating?: (profile: { id: string; isAdmin: boolean }) => Promise<boolean>;
    /** Whether favorite systems are on for this profile (`use_signed_in_home`). Omitted: no. */
    showFavoriteSystems?: (profile: { id: string; isAdmin: boolean }) => Promise<boolean>;
    /** Whether Quem mestra is on for the viewer (`api_directory_gms`), so the role tag shows. */
    showTableRole?: boolean;
    /**
     * Whether to read the follow part too: whether the viewer follows this person, and for the
     * owner how many follow them. The caller decides who sees it (`use_follows`). Omitted: null.
     */
    withFollows?: boolean;
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
      name: profiles.name,
      showName: profiles.showName,
      showFavoriteSystems: profiles.showFavoriteSystems,
      tableRole: profiles.tableRole,
      role: profiles.role,
    })
    .from(profiles)
    .where(and(eq(profiles.username, normalizeUsername(username)), eq(profiles.status, 'active')))
    .limit(1);
  if (!found) return null;

  const isOwnerView = viewerId === found.id;
  const target = { id: found.id, isAdmin: found.role === 'admin' };
  // Everything below depends only on the profile row, so it all goes out at once: awaiting the
  // flag-gated reads one after another made Sentry flag the page for consecutive DB queries.
  const [
    links,
    totals,
    rating,
    upcoming,
    reviews,
    badges,
    participantRating,
    favoriteSystems,
    follows,
  ] = await Promise.all([
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
    publicGmReviews(db, found.id),
    // Null: the rollout has not reached this profile, so the page shows no strip at all.
    (async () =>
      (await showBadges?.(target))
        ? heldBadges(db, found.id, { includeHidden: isOwnerView })
        : null)(),
    // Null: the rollout has not reached this profile, so its "Mesas jogadas" tile has no score.
    (async () =>
      (await showParticipantRating?.(target)) ? participantRatingOf(db, found.id, now) : null)(),
    // Null: the rollout has not reached this profile, or its owner hid them. Pills under the bio.
    (async () =>
      found.showFavoriteSystems && (await showFavoriteSystems?.(target))
        ? readFavoriteSystems(db, found.id)
        : null)(),
    (async () => {
      if (!withFollows) return null;
      const [following, followers] = await Promise.all([
        viewerId && !isOwnerView ? isFollowing(db, viewerId, found.id) : false,
        isOwnerView ? followerCount(db, found.id) : null,
      ]);
      return { following, followers };
    })(),
  ]);

  return {
    // Who the page is about, for the caller's flag targeting (rollouts are by the profile shown).
    subject: target,
    follows,
    badges,
    profile: {
      username: found.username!,
      avatarUrl: pictureOf(supabaseUrl, found),
      bannerUrl: bannerUrl(supabaseUrl, found.bannerPath),
      // Plain text in the person's own words; the page keeps its line breaks and escapes it.
      bio: found.bio,
      // Under the @usuário, only when the person chose to show it.
      name: (found.showName && found.name) || null,
      // "Joga", "Mestra" or both, beside the badges; null for no answer or while Quem mestra is off.
      tableRole: showTableRole ? found.tableRole : null,
      // `text` is shown next to the icon; `href` is null where there is nothing to open (Discord).
      links: links.flatMap((link) => {
        if (!isNetwork(link.network)) return [];
        const target = socialTarget({ ...link, network: link.network });
        return target ? [{ network: link.network, ...target }] : [];
      }),
      totals,
      rating,
      participantRating,
      favoriteSystems,
    },
    tables: upcoming.tables.map((table) => ({
      slug: table.slug,
      title: table.title,
      kind: table.kind,
      system: table.system,
      gmName: table.gmName,
      gmShownName: table.gmShownName,
      gmAvatar: pictureOf(supabaseUrl, {
        avatarPath: table.gmAvatarPath,
        avatarUrl: table.gmAvatarUrl,
      }),
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
    // "Avaliações da mestragem": only the comments their authors chose to show here.
    reviews: reviews.map((review) => ({
      username: review.username!,
      avatarUrl: pictureOf(supabaseUrl, review),
      score: review.gmScore,
      text: review.comment!,
      createdAt: review.createdAt,
      table: { title: review.tableTitle, slug: review.tableSlug },
    })),
    page,
    pages: Math.max(1, Math.ceil(upcoming.total / PUBLIC_PROFILE_PAGE_SIZE)),
    total: upcoming.total,
    // This per-request action flag is never stored in a shared public Query cache.
    isOwner: isOwnerView,
  };
}
