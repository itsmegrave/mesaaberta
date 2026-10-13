import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profileSocialLinks, profiles } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { diffFields, hasChanges } from '../events/changes';
import { recordEvent } from '../events/outbox';
import { normalizeUsername } from '$lib/profile/username';
import { profileLinks, type ProfileInput } from '$lib/profile/schema';
import { isNetwork, typedValue } from '$lib/profile/social-links';

/** A Postgres unique violation on the username index (drizzle wraps the driver's error as `cause`). */
function isUsernameConflict(error: unknown): boolean {
  const { code, constraint_name, constraint, message } = ((error as { cause?: unknown }).cause ??
    error) as Record<string, string | undefined>;

  return code === '23505' && `${constraint_name ?? constraint ?? message}`.includes('username');
}

/**
 * Whether nobody else has this username. Advisory only: it can go stale a moment later, so the
 * unique index still decides when the profile is saved (see `saveProfile`).
 */
export async function isUsernameAvailable(
  db: AnyDb,
  username: string,
  { exceptProfileId }: { exceptProfileId?: string } = {},
): Promise<boolean> {
  const [taken] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(sql`lower(${profiles.username})`, normalizeUsername(username)),
        exceptProfileId ? ne(profiles.id, exceptProfileId) : undefined,
      ),
    )
    .limit(1);

  return !taken;
}

/** The profile as the form shows it: blanks as empty text, the links as two parallel lists. */
export async function loadProfileForm(
  db: AnyDb,
  profileId: string,
): Promise<Omit<ProfileInput, never> | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile) return null;

  const links = await db
    .select({
      network: profileSocialLinks.network,
      handle: profileSocialLinks.handle,
      url: profileSocialLinks.url,
    })
    .from(profileSocialLinks)
    .where(eq(profileSocialLinks.profileId, profileId))
    .orderBy(asc(profileSocialLinks.position));

  return {
    username: profile.username ?? '',
    name: profile.name ?? '',
    ageRange: profile.ageRange ?? '',
    gender: profile.gender ?? '',
    genderOther: profile.genderOther ?? '',
    city: profile.city ?? '',
    timezone: profile.timezone ?? '',
    linkNetwork: links.map((link) => link.network),
    // What the person typed: the handle of a network, the address of a website.
    linkUrl: links.map((link) =>
      typedValue({ ...link, network: isNetwork(link.network) ? link.network : 'website' }),
    ),
  };
}

/**
 * Saves the profile the form describes, and replaces its social links with the ones sent, in the
 * order sent. `input` is already validated. The unique index has the last word on the username: if
 * someone takes it between the availability check and here, this throws `Invalid('username',
 * 'taken')`, the same answer the form gives for a name that was taken all along.
 */
export async function saveProfile(db: AnyDb, profileId: string, input: ProfileInput) {
  const links = profileLinks(input);
  const values = {
    username: normalizeUsername(input.username),
    name: input.name || null,
    ageRange: input.ageRange || null,
    gender: input.gender || null,
    // Own words go with "Outro" only; picking another option forgets them.
    genderOther: (input.gender === 'other' && input.genderOther) || null,
    city: input.city || null,
    timezone: input.timezone || null,
  };

  try {
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(profiles).where(eq(profiles.id, profileId));
      if (!before) throw new NotFound(`no profile ${profileId}`);
      const linksBefore = await tx
        .select({
          network: profileSocialLinks.network,
          handle: profileSocialLinks.handle,
          url: profileSocialLinks.url,
        })
        .from(profileSocialLinks)
        .where(eq(profileSocialLinks.profileId, profileId))
        .orderBy(asc(profileSocialLinks.position));

      await tx.update(profiles).set(values).where(eq(profiles.id, profileId));
      await tx.delete(profileSocialLinks).where(eq(profileSocialLinks.profileId, profileId));
      if (links.length > 0) {
        await tx
          .insert(profileSocialLinks)
          .values(links.map((link, position) => ({ profileId, ...link, position })));
      }

      // The history: what the person changed, by themselves. Who they are (name, age range, gender,
      // city) is personal data, so it says that it changed and what it became is not kept.
      const linkText = (rows: { network: string; handle?: string | null; url: string | null }[]) =>
        rows.map((link) => `${link.network}: ${link.handle ?? link.url}`);
      const changes = diffFields(
        { ...before, links: linkText(linksBefore) },
        { ...values, links: linkText(links) },
        { hidden: ['name', 'ageRange', 'gender', 'genderOther', 'city'] },
      );
      if (hasChanges(changes))
        await recordEvent(tx as unknown as AnyDb, {
          type: 'ProfileUpdated',
          actorId: profileId,
          payload: { profileId, changes },
        });
    });
  } catch (error) {
    if (isUsernameConflict(error)) throw new Invalid('username', 'taken');
    throw error;
  }
}
