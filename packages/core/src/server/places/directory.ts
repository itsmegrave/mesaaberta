import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, placeLinks, places, placeTags } from '../db/schema';
import { escapeLike, folded, openSql } from '../directories/sql';
import { listUpcomingTables } from '../tables/queries';
import { PLACE_PAGE_SIZE, type PlaceFilters } from '../../places/filters';
import { foldText } from '../../systems/directory-filters';
import { orderedAmenities, type PlaceAmenity, type PlaceKind } from '../../places/types';
import type { Network } from '../../profile/social-links';

// The public side of "Onde jogar" (`/places`, `/pp/<slug>`). The list and the filters only ever
// read places that are approved, not removed and not hidden; a place's own page also opens for
// whoever sent it, owns it or moderates, with the state it is in.

/** Up on the public pages: approved, not removed, not hidden for reports. */
export const listed = and(
  isNotNull(places.approvedAt),
  isNull(places.removedAt),
  isNull(places.hiddenAt),
);

/** Tables open now (active, not started) at each place, as a subquery to join. */
const openAt = (db: AnyDb, now: Date) =>
  db
    .select({
      placeId: gameTables.placeId,
      open: sql<number>`count(*)::int`.as('open'),
    })
    .from(gameTables)
    .where(and(isNotNull(gameTables.placeId), isNull(gameTables.moderatedAt), openSql(now)))
    .groupBy(gameTables.placeId)
    .as('open_at');

const hasTag = (kind: string, slug: string) =>
  exists(
    sql`(select 1 from ${placeTags} where ${placeTags.placeId} = ${places.id} and ${placeTags.kind} = ${kind} and ${placeTags.slug} = ${slug})`,
  );

export type PlaceCard = {
  slug: string;
  name: string;
  kind: PlaceKind;
  neighbourhood: string | null;
  city: string;
  state: string;
  description: string | null;
  amenities: PlaceAmenity[];
  imagePath: string | null;
  openTables: number;
};

/**
 * One page of `/places` for the filters, and what the Estado and Cidade filters can offer: the
 * states with a place listed, and the cities of the state picked. Null for a page past the last
 * one, which the page answers with a 404 (the first page always exists, even empty).
 */
export async function listPlaces(db: AnyDb, filters: PlaceFilters, now: Date) {
  const open = openAt(db, now);
  const openTables = sql<number>`coalesce(${open.open}, 0)`;
  const needle = filters.query ? `%${escapeLike(foldText(filters.query))}%` : null;
  const where = and(
    listed,
    needle
      ? sql`(${folded(places.name)} like ${needle} or ${folded(places.description)} like ${needle} or ${folded(places.city)} like ${needle} or ${folded(places.neighbourhood)} like ${needle})`
      : undefined,
    filters.state ? hasTag('state', filters.state) : undefined,
    filters.city ? hasTag('city', filters.city) : undefined,
    filters.kind ? eq(places.kind, filters.kind) : undefined,
    filters.amenities.length > 0 ? arrayContains(places.amenities, filters.amenities) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(places).where(where);
  const pages = Math.max(1, Math.ceil(total / PLACE_PAGE_SIZE));
  if (filters.page > pages) return null;

  const order = {
    open: [desc(openTables), asc(sql`lower(${places.name})`)],
    recent: [desc(places.approvedAt), asc(places.id)],
    name: [asc(sql`lower(${places.name})`), asc(places.id)],
  }[filters.sort];
  const [rows, states, cities] = await Promise.all([
    db
      .select({
        slug: places.slug,
        name: places.name,
        kind: places.kind,
        neighbourhood: places.neighbourhood,
        city: places.city,
        state: places.state,
        description: places.description,
        amenities: places.amenities,
        imagePath: places.imagePath,
        openTables,
      })
      .from(places)
      .leftJoin(open, eq(open.placeId, places.id))
      .where(where)
      .orderBy(...order)
      .limit(PLACE_PAGE_SIZE)
      .offset((filters.page - 1) * PLACE_PAGE_SIZE),
    tagOptions(db, 'state'),
    filters.state ? tagOptions(db, 'city', `${filters.state}-`) : Promise.resolve([]),
  ]);

  return {
    total,
    pages,
    states,
    cities,
    places: rows.map((row) => ({
      ...row,
      amenities: orderedAmenities(row.amenities),
    })) as PlaceCard[],
  };
}

export type PlaceList = NonNullable<Awaited<ReturnType<typeof listPlaces>>>;

/** The tags of one kind that listed places carry, A to Z: the options of a filter. */
async function tagOptions(db: AnyDb, kind: 'state' | 'city', prefix?: string) {
  return db
    .selectDistinct({ slug: placeTags.slug, label: placeTags.label })
    .from(placeTags)
    .innerJoin(places, eq(places.id, placeTags.placeId))
    .where(
      and(
        listed,
        eq(placeTags.kind, kind),
        prefix ? sql`${placeTags.slug} like ${`${escapeLike(prefix)}%`}` : undefined,
      ),
    )
    .orderBy(asc(placeTags.label));
}

// How many upcoming tables a place's page shows before "Ver todas em Mesas".
const PAGE_TABLES = 6;

/** Who is looking at a place's page, for what they may see and do there. */
export type PlaceViewer = { id: string; isAdmin: boolean } | null;

/**
 * Everything the page of one place (`/pp/<slug>`) shows. Null when no one may see it: a removed or
 * unknown place, or one that waits for review or is hidden, to anyone but its submitter, its owner
 * and admins. Those see it with `pending` or `hidden` set. Who sent it is never returned.
 */
export async function readPlacePage(db: AnyDb, slug: string, viewer: PlaceViewer, now: Date) {
  const [place] = await db
    .select()
    .from(places)
    .where(and(eq(places.slug, slug), isNull(places.removedAt)));
  if (!place) return null;
  const pending = place.approvedAt === null;
  const hidden = place.hiddenAt !== null;
  const mine = viewer !== null && (viewer.id === place.submitterId || viewer.id === place.ownerId);
  const insider = mine || viewer?.isAdmin === true;
  if ((pending || hidden) && !insider) return null;

  const [links, tags, tables, [{ open }]] = await Promise.all([
    db
      .select({ network: placeLinks.network, url: placeLinks.url })
      .from(placeLinks)
      .where(eq(placeLinks.placeId, place.id))
      .orderBy(asc(placeLinks.position)),
    db
      .select({ kind: placeTags.kind, label: placeTags.label, slug: placeTags.slug })
      .from(placeTags)
      .where(eq(placeTags.placeId, place.id)),
    listUpcomingTables(db, now, { placeId: place.id, limit: PAGE_TABLES }),
    db
      .select({ open: count() })
      .from(gameTables)
      .where(and(eq(gameTables.placeId, place.id), isNull(gameTables.moderatedAt), openSql(now))),
  ]);

  const TAG_ORDER = ['state', 'city', 'neighbourhood', 'kind', 'amenity'];
  return {
    place: {
      id: place.id,
      slug: place.slug,
      name: place.name,
      kind: place.kind,
      description: place.description,
      postalCode: place.postalCode,
      street: place.street,
      complement: place.complement,
      neighbourhood: place.neighbourhood,
      city: place.city,
      state: place.state,
      openingHours: place.openingHours,
      amenities: orderedAmenities(place.amenities),
      siteUrl: place.siteUrl,
      imagePath: place.imagePath,
      verified: place.ownerId !== null,
    },
    links: links as { network: Exclude<Network, 'website'>; url: string }[],
    tags: tags.sort((a, b) => TAG_ORDER.indexOf(a.kind) - TAG_ORDER.indexOf(b.kind)),
    tables: tables.map(({ gmId, ...table }) => table),
    openTables: open,
    pending,
    hidden,
    /** The viewer sent it or owns it, or moderates: they may edit it. */
    canEdit: insider,
    /** The viewer is its owner: their edits publish at once. */
    owner: viewer !== null && viewer.id === place.ownerId,
    /** Nobody owns it yet, and it is up: "Este lugar é seu? Reivindicar". */
    claimable: !pending && !hidden && place.ownerId === null,
    /** "Denunciar lugar": anyone but whoever sent it or owns it. */
    canReport: !mine && !pending,
  };
}

export type PlacePage = NonNullable<Awaited<ReturnType<typeof readPlacePage>>>;
