import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';
import { PROFILE_LIMITS } from '$lib/profile/schema';

/** The part of a Supabase user this needs. Provider details arrive in `user_metadata`. */
export type AuthUser = { id: string; user_metadata?: Record<string, unknown> };

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Pre-fills the optional `name`. Never from the email address: it is personal data. Null when the
// provider gave none: the person picks their username at the onboarding step.
const nameOf = (metadata: Record<string, unknown>) =>
	(text(metadata.full_name) || text(metadata.name) || text(metadata.user_name)).slice(
		0,
		PROFILE_LIMITS.name
	) || null;

// Only https pictures: the value is rendered in an <img> and comes from a third party.
const avatarOf = (metadata: Record<string, unknown>) => {
	const url = text(metadata.avatar_url) || text(metadata.picture);
	return url.startsWith('https://') ? url : null;
};

/**
 * Makes sure the signed-in user has a profile, creating a `member` one on first login (without a
 * username: that comes from the onboarding step). An existing profile is returned as it is: the
 * provider's name or picture changing later, or an admin's role, must not be overwritten by a login.
 */
export async function ensureProfile(db: AnyDb, user: AuthUser) {
	const metadata = user.user_metadata ?? {};

	const [created] = await db
		.insert(profiles)
		.values({ id: user.id, name: nameOf(metadata), avatarUrl: avatarOf(metadata) })
		.onConflictDoNothing()
		.returning();
	if (created) return created;

	const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id));
	return existing;
}
