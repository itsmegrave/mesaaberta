import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, placeFeatures, placeLinks, places, placeTags } from '../db/schema';
import { escapeLike, folded, openSql } from '../directories/sql';
import { listUpcomingTables } from '../tables/queries';
import { PLACE_PAGE_SIZE, type PlaceFilters } from '../../places/filters';
import { foldText } from '../../systems/directory-filters';
import type { PlaceFeature } from '../../places/features';
import type { PlaceKind } from '../../places/types';
import { featuresOf } from './features';
import { isPartnerPlace, partnerOfPlace } from './partner-links';
import { placeGms, placeSystems } from './people';
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
  /** Its approved tags, in the order it picked them. */
  features: PlaceFeature[];
  imagePath: string | null;
  openTables: number;
  /** Shown as a partner's ("Parceiro"): its link is up. */
  partner: boolean;
};

/**
 * One page of `/places` for the filters, and what the Estado, Cidade and Tags filters can offer:
 * the states with a place listed, the cities of the state picked, and the approved tags some listed
 * place has (plus any picked in the address, so a pick never vanishes from its own filter). Null for
 * a page past the last one, which the page answers with a 404 (the first page always exists, even
 * empty).
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
    ...filters.tags.map((slug) => hasTag('feature', slug)),
    filters.partner ? isPartnerPlace() : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(places).where(where);
  const pages = Math.max(1, Math.ceil(total / PLACE_PAGE_SIZE));
  if (filters.page > pages) return null;

  const order = {
    open: [desc(openTables), asc(sql`lower(${places.name})`)],
    recent: [desc(places.approvedAt), asc(places.id)],
    name: [asc(sql`lower(${places.name})`), asc(places.id)],
  }[filters.sort];
  const [rows, states, cities, tags] = await Promise.all([
    db
      .select({
        slug: places.slug,
        name: places.name,
        kind: places.kind,
        neighbourhood: places.neighbourhood,
        city: places.city,
        state: places.state,
        id: places.id,
        description: places.description,
        imagePath: places.imagePath,
        openTables,
        partner: isPartnerPlace(),
      })
      .from(places)
      .leftJoin(open, eq(open.placeId, places.id))
      .where(where)
      .orderBy(...order)
      .limit(PLACE_PAGE_SIZE)
      .offset((filters.page - 1) * PLACE_PAGE_SIZE),
    tagOptions(db, 'state'),
    filters.state ? tagOptions(db, 'city', `${filters.state}-`) : Promise.resolve([]),
    featureOptions(db, filters.tags),
  ]);
  const features = await featuresOf(
    db,
    rows.map((row) => row.id),
  );

  return {
    total,
    pages,
    states,
    cities,
    tags,
    places: rows.map(({ id, ...row }) => ({
      ...row,
      features: features.get(id) ?? [],
    })) as PlaceCard[],
  };
}

export type PlaceList = NonNullable<Awaited<ReturnType<typeof listPlaces>>>;

/** The cards of these places that are listed, in the order of `ids`: a partner's "Onde jogar". */
export async function placeCardsOf(
  db: AnyDb,
  ids: readonly string[],
  now: Date,
): Promise<PlaceCard[]> {
  if (ids.length === 0) return [];
  const open = openAt(db, now);
  const rows = await db
    .select({
      slug: places.slug,
      name: places.name,
      kind: places.kind,
      neighbourhood: places.neighbourhood,
      city: places.city,
      state: places.state,
      id: places.id,
      description: places.description,
      imagePath: places.imagePath,
      openTables: sql<number>`coalesce(${open.open}, 0)`,
      partner: isPartnerPlace(),
    })
    .from(places)
    .leftJoin(open, eq(open.placeId, places.id))
    .where(and(listed, inArray(places.id, [...ids])));
  const features = await featuresOf(
    db,
    rows.map((row) => row.id),
  );
  const at = new Map(ids.map((id, index) => [id, index]));
  return rows
    .sort((a, b) => at.get(a.id)! - at.get(b.id)!)
    .map(({ id, ...row }) => ({ ...row, features: features.get(id) ?? [] })) as PlaceCard[];
}

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

/**
 * The approved catalog tags that at least one listed place has, in catalog order, and those
 * `picked` in the address whatever they are: the options of the Tags filter.
 */
async function featureOptions(db: AnyDb, picked: readonly string[]) {
  const used = exists(
    sql`(select 1 from ${placeTags} join ${places} on ${places.id} = ${placeTags.placeId} where ${placeTags.kind} = 'feature' and ${placeTags.slug} = ${placeFeatures.slug} and ${listed})`,
  );
  return db
    .select({ slug: placeFeatures.slug, name: placeFeatures.name })
    .from(placeFeatures)
    .where(
      and(
        eq(placeFeatures.status, 'approved'),
        picked.length > 0 ? or(used, inArray(placeFeatures.slug, [...picked])) : used,
      ),
    )
    .orderBy(asc(placeFeatures.position), asc(placeFeatures.name));
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

  const [links, tags, tables, [{ open }], features, partner, gms, systemsHere] = await Promise.all([
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
    // Whoever may edit it also sees the tags they suggested that still wait for an admin.
    featuresOf(db, [place.id], { withPending: insider }),
    partnerOfPlace(db, place.id),
    placeGms(db, place.id, now),
    placeSystems(db, place.id, now),
  ]);

  // The catalog tags come apart (`features`), as the place picked them; these are the rest, made
  // from its address and kind. `amenity` rows from before the catalog are left out.
  const TAG_ORDER = ['state', 'city', 'neighbourhood', 'kind'];
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
      siteUrl: place.siteUrl,
      imagePath: place.imagePath,
      verified: place.ownerId !== null,
    },
    links: links as { network: Exclude<Network, 'website'>; url: string }[],
    tags: tags
      .filter((tag) => TAG_ORDER.includes(tag.kind))
      .sort((a, b) => TAG_ORDER.indexOf(a.kind) - TAG_ORDER.indexOf(b.kind)),
    /** Its tags, in the order picked; pending ones only for whoever may edit it, marked. */
    features: features.get(place.id) ?? [],
    tables: tables.map(({ gmId, ...table }) => table),
    openTables: open,
    /** "Parceiro Mesa Aberta": the partner it is shown as, once an admin approved the link. */
    partner,
    /** "Quem mestra aqui": the house GMs, then who ran a table here in the last year. */
    gms,
    /** "Sistemas jogados aqui", from its tables of the last year. */
    systems: systemsHere,
    pending,
    hidden,
    /** The viewer sent it or owns it, or moderates: they may edit it. */
    canEdit: insider,
    /** "Denunciar lugar" once it is listed: anyone but whoever sent it or owns it (a visitor signs in first). */
    canReport: !mine && !pending && !hidden,
    /** The viewer is its owner: their edits publish at once. */
    owner: viewer !== null && viewer.id === place.ownerId,
    /** Nobody owns it yet, and it is up: "Este lugar é seu? Reivindicar". */
    claimable: !pending && !hidden && place.ownerId === null,
  };
}

export type PlacePage = NonNullable<Awaited<ReturnType<typeof readPlacePage>>>;
