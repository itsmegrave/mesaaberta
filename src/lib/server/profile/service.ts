import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profileSocialLinks, profiles } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { normalizeUsername } from '$lib/profile/username';
import { profileLinks, type ProfileInput } from '$lib/profile/schema';

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
	{ exceptProfileId }: { exceptProfileId?: string } = {}
): Promise<boolean> {
	const [taken] = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(
			and(
				eq(sql`lower(${profiles.username})`, normalizeUsername(username)),
				exceptProfileId ? ne(profiles.id, exceptProfileId) : undefined
			)
		)
		.limit(1);

	return !taken;
}

/** The profile as the form shows it: blanks as empty text, the links as two parallel lists. */
export async function loadProfileForm(
	db: AnyDb,
	profileId: string
): Promise<Omit<ProfileInput, never> | null> {
	const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
	if (!profile) return null;

	const links = await db
		.select({ network: profileSocialLinks.network, url: profileSocialLinks.url })
		.from(profileSocialLinks)
		.where(eq(profileSocialLinks.profileId, profileId))
		.orderBy(asc(profileSocialLinks.position));

	return {
		username: profile.username ?? '',
		name: profile.name ?? '',
		age: profile.age,
		gender: profile.gender ?? '',
		city: profile.city ?? '',
		linkNetwork: links.map((link) => link.network),
		linkUrl: links.map((link) => link.url)
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

	try {
		await db.transaction(async (tx) => {
			const updated = await tx
				.update(profiles)
				.set({
					username: normalizeUsername(input.username),
					name: input.name || null,
					age: input.age,
					gender: input.gender || null,
					city: input.city || null
				})
				.where(eq(profiles.id, profileId))
				.returning({ id: profiles.id });
			if (updated.length === 0) throw new NotFound(`no profile ${profileId}`);

			await tx.delete(profileSocialLinks).where(eq(profileSocialLinks.profileId, profileId));
			if (links.length > 0) {
				await tx
					.insert(profileSocialLinks)
					.values(links.map((link, position) => ({ profileId, ...link, position })));
			}
		});
	} catch (error) {
		if (isUsernameConflict(error)) throw new Invalid('username', 'taken');
		throw error;
	}
}
