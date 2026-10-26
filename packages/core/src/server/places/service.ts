import { and, asc, eq, isNull, like, ne, sql } from 'drizzle-orm';
import { placeLinks, type PlaceInput } from '../../places/schema';
import { orderedAmenities } from '../../places/types';
import { normalizeCep } from '../../location/cep';
import { parseSocialUrl, type Network } from '../../profile/social-links';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { placeLinks as placeLinksTable, places } from '@mesaaberta/core/server/db/schema';
import { Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import type { Changes } from '@mesaaberta/core/server/events/types';
import { lookupCep } from '@mesaaberta/core/server/location/cep';
import { enforceRateLimit, PLACE_LIMIT } from '@mesaaberta/core/server/rate-limit';
import { nextFreeSlug, slugify } from '@mesaaberta/core/slug';
import { clearPlaceTags, rebuildPlaceTags } from './tags';

// The member side of "Onde jogar": sending a place, editing it and taking it off. A place waits for
// an admin (`approvedAt`, see `./admin`) before it is public. Its submitter's edit sends it back to
// review; an admin's or its owner's does not. Errors are codes only; the web app words them.

/** Slugs a place may not have: `/pp/new` is the form. */
const RESERVED_PLACE_SLUGS: ReadonlySet<string> = new Set(['new']);
const MAX_SLUG_ATTEMPTS = 5;

/**
 * The name and CEP of another place that is still up. `slug` is null unless the person may open
 * it (it is approved, or they sent it), so the form can link to it without showing one that waits.
 */
export class PlaceDuplicate extends Invalid {
  constructor(readonly slug: string | null) {
    super('name', 'place_duplicate');
    this.name = 'PlaceDuplicate';
  }
}

/** A Postgres unique violation, and on which index (drizzle wraps the driver's error as `cause`). */
function conflictOn(error: unknown): string | null {
  const { code, constraint_name, constraint, message } = ((error as { cause?: unknown }).cause ??
    error) as Record<string, string | undefined>;
  return code === '23505' ? `${constraint_name ?? constraint ?? message}` : null;
}

const textOrNull = (raw: string) => (raw.trim() === '' ? null : raw.trim());

type Location = { postalCode: string; neighbourhood: string | null; city: string; state: string };

/**
 * What the CEP resolves to, through the `postal_codes` cache or ViaCEP. A place needs its city,
 * so a CEP that does not exist (`not_found`) or cannot be looked up now (`unavailable`) is refused
 * on the `postalCode` field.
 */
async function locate(db: AnyDb, raw: string, request: typeof fetch): Promise<Location> {
  const postalCode = normalizeCep(raw);
  if (!postalCode) throw new Invalid('postalCode', 'invalid');
  const found = await lookupCep(db, postalCode, request);
  if (found.status !== 'found') throw new Invalid('postalCode', found.status);
  return { postalCode, ...found.place };
}

/** The columns an add or an edit writes, from a validated form and its resolved CEP. */
function columnsOf(input: PlaceInput, location: Location) {
  return {
    name: input.name,
    kind: input.kind,
    description: textOrNull(input.description),
    ...location,
    street: input.street.trim(),
    complement: textOrNull(input.complement),
    openingHours: textOrNull(input.openingHours),
    amenities: orderedAmenities(input.amenities),
    siteUrl: input.siteUrl.trim() === '' ? null : parseSocialUrl(input.siteUrl),
  };
}

/** Refuses a name and CEP another place that is still up already has (`PlaceDuplicate`). */
async function refuseDuplicate(
  db: AnyDb,
  viewerId: string,
  name: string,
  postalCode: string,
  exceptId?: string,
) {
  const [twin] = await db
    .select({ slug: places.slug, approvedAt: places.approvedAt, submitterId: places.submitterId })
    .from(places)
    .where(
      and(
        eq(sql`lower(${places.name})`, name.toLowerCase()),
        eq(places.postalCode, postalCode),
        isNull(places.removedAt),
        exceptId ? ne(places.id, exceptId) : undefined,
      ),
    );
  if (!twin) return;
  const visible = twin.approvedAt !== null || twin.submitterId === viewerId;
  throw new PlaceDuplicate(visible ? twin.slug : null);
}

async function writeLinks(db: AnyDb, placeId: string, input: PlaceInput) {
  await db.delete(placeLinksTable).where(eq(placeLinksTable.placeId, placeId));
  const links = placeLinks(input);
  if (links.length === 0) return;
  await db
    .insert(placeLinksTable)
    .values(links.map((link, position) => ({ placeId, position, ...link })));
}

/**
 * A member sends a place: it waits for an admin, credited to them (only admins see who). Refused
 * when another place that is up has the same name and CEP (`PlaceDuplicate`), when the CEP does
 * not resolve, and past PLACE_LIMIT. Returns its slug and the `PlaceSubmitted` event to dispatch.
 */
export async function submitPlace(
  db: AnyDb,
  actor: Actor | null,
  input: PlaceInput,
  {
    imagePath = null,
    now = new Date(),
    request = fetch,
  }: { imagePath?: string | null; now?: Date; request?: typeof fetch } = {},
): Promise<{ id: string; slug: string; eventId: string }> {
  authorize(actor, 'place:submit');
  const location = await locate(db, input.postalCode, request);
  await refuseDuplicate(db, actor!.id, input.name, location.postalCode);

  const base = slugify(input.name, { fallback: 'lugar' });
  for (let attempt = 1; ; attempt++) {
    const taken = new Set(
      (
        await db
          .select({ slug: places.slug })
          .from(places)
          .where(like(places.slug, `${base}%`))
      ).map((row) => row.slug),
    );
    const slug = nextFreeSlug(
      base,
      (candidate) => RESERVED_PLACE_SLUGS.has(candidate) || taken.has(candidate),
    );
    try {
      return await db.transaction(async (tx) => {
        const t = tx as unknown as AnyDb;
        await enforceRateLimit(t, actor!.id, PLACE_LIMIT, now);
        const [row] = await t
          .insert(places)
          .values({
            slug,
            submitterId: actor!.id,
            imagePath,
            ...columnsOf(input, location),
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: places.id });
        await writeLinks(t, row.id, input);
        const eventId = await recordEvent(
          t,
          {
            type: 'PlaceSubmitted',
            actorId: actor!.id,
            payload: { placeId: row.id, slug, name: input.name },
          },
          { now },
        );
        return { id: row.id, slug, eventId };
      });
    } catch (error) {
      const index = conflictOn(error);
      // Someone sent the same place a moment ago.
      if (index?.includes('name_cep')) {
        await refuseDuplicate(db, actor!.id, input.name, location.postalCode);
      }
      if (index?.includes('slug') && attempt < MAX_SLUG_ATTEMPTS) continue;
      throw error;
    }
  }
}

/** A place as its edit form needs it. Only those who may edit it open it; a removed one is gone. */
export async function findEditablePlace(db: AnyDb, actor: Actor | null, slug: string) {
  const [row] = await db
    .select()
    .from(places)
    .where(and(eq(places.slug, slug), isNull(places.removedAt)));
  if (!row) throw new NotFound(`no place "${slug}"`);
  authorize(actor, 'place:edit', row);
  const links = await db
    .select({ network: placeLinksTable.network, url: placeLinksTable.url })
    .from(placeLinksTable)
    .where(eq(placeLinksTable.placeId, row.id))
    .orderBy(asc(placeLinksTable.position));
  return { ...row, links: links as { network: Exclude<Network, 'website'>; url: string }[] };
}

/**
 * Edits a place. Its submitter's edit sends it back to review: it leaves the list (and its tags go)
 * until an admin approves it again. An admin's or its owner's edit keeps it up and rebuilds its tags.
 * A new photo replaces the old one, and `removeImage` takes it off; the path that was replaced is
 * returned so the caller can delete that file. Returns the `PlaceUpdated` event to dispatch.
 */
export async function updatePlace(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  input: PlaceInput,
  {
    imagePath = null,
    now = new Date(),
    request = fetch,
  }: { imagePath?: string | null; now?: Date; request?: typeof fetch } = {},
): Promise<{ eventId: string; slug: string; replacedImage: string | null; pending: boolean }> {
  const [found] = await db
    .select()
    .from(places)
    .where(and(eq(places.id, id), isNull(places.removedAt)));
  if (!found) throw new NotFound(`no place "${id}"`);
  authorize(actor, 'place:edit', found);
  const location =
    normalizeCep(input.postalCode) === found.postalCode
      ? {
          postalCode: found.postalCode,
          neighbourhood: found.neighbourhood,
          city: found.city,
          state: found.state,
        }
      : await locate(db, input.postalCode, request);
  await refuseDuplicate(db, actor!.id, input.name, location.postalCode, id);

  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [current] = await t
      .select()
      .from(places)
      .where(and(eq(places.id, id), isNull(places.removedAt)))
      .for('update');
    if (!current) throw new NotFound(`no place "${id}"`);
    authorize(actor, 'place:edit', current);

    const next = columnsOf(input, location);
    const changes: Changes = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      const [from, to] =
        key === 'amenities'
          ? [current.amenities.join(','), next.amenities.join(',')]
          : [current[key], next[key]];
      if (from !== to) changes[key] = { from, to };
    }
    const oldLinks = await t
      .select({ url: placeLinksTable.url })
      .from(placeLinksTable)
      .where(eq(placeLinksTable.placeId, id))
      .orderBy(asc(placeLinksTable.position));
    const links = placeLinks(input).map((link) => link.url);
    if (links.join('\n') !== oldLinks.map((link) => link.url).join('\n')) {
      changes.links = { from: oldLinks.length, to: links.length };
    }
    const dropImage = !imagePath && input.removeImage && current.imagePath !== null;
    if (imagePath || dropImage) changes.image = { redacted: true };

    // Only someone the place does not vouch for sends it back: not an admin, not its owner.
    const reviewAgain = actor!.role !== 'admin' && actor!.id !== current.ownerId;
    const pending = reviewAgain || current.approvedAt === null;
    await t
      .update(places)
      .set({
        ...next,
        ...(imagePath ? { imagePath } : dropImage ? { imagePath: null } : {}),
        ...(reviewAgain ? { approvedAt: null, approvedBy: null } : {}),
        updatedAt: now,
      })
      .where(eq(places.id, id));
    await writeLinks(t, id, input);
    if (pending) await clearPlaceTags(t, id);
    else await rebuildPlaceTags(t, id, next);

    const eventId = await recordEvent(
      t,
      {
        type: 'PlaceUpdated',
        actorId: actor!.id,
        payload: { placeId: id, slug: current.slug, name: input.name, changes },
      },
      { now },
    );
    return {
      eventId,
      slug: current.slug,
      replacedImage: imagePath || dropImage ? current.imagePath : null,
      pending,
    };
  });
}

/**
 * Its submitter or owner takes the place off. It leaves the list and the table picker; tables that
 * picked it keep their copied area. Returns the `PlaceRemoved` event to dispatch.
 */
export async function withdrawPlace(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t
      .select()
      .from(places)
      .where(and(eq(places.id, id), isNull(places.removedAt)))
      .for('update');
    if (!place) throw new NotFound(`no place "${id}"`);
    authorize(actor, 'place:withdraw', place);

    await t
      .update(places)
      .set({ removedAt: now, removedBy: actor!.id, removalReason: null, removalNote: null })
      .where(eq(places.id, id));
    await clearPlaceTags(t, id);
    return [
      await recordEvent(
        t,
        {
          type: 'PlaceRemoved',
          actorId: actor!.id,
          payload: {
            placeId: id,
            slug: place.slug,
            name: place.name,
            submitterId: place.submitterId,
            reason: null,
            reportId: null,
          },
        },
        { now },
      ),
    ];
  });
}
