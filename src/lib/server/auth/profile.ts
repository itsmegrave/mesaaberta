import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';

/** The part of a Supabase user this needs. Provider details arrive in `user_metadata`. */
export type AuthUser = { id: string; user_metadata?: Record<string, unknown> };

const DEFAULT_NAME = 'Jogador';
const MAX_NAME_LENGTH = 60;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Never from the email address: it is personal data and would end up shown to other players.
const displayNameOf = (metadata: Record<string, unknown>) =>
	(text(metadata.full_name) || text(metadata.name) || text(metadata.user_name)).slice(
		0,
		MAX_NAME_LENGTH
	) || DEFAULT_NAME;

// Only https pictures: the value is rendered in an <img> and comes from a third party.
const avatarOf = (metadata: Record<string, unknown>) => {
	const url = text(metadata.avatar_url) || text(metadata.picture);
	return url.startsWith('https://') ? url : null;
};

/**
 * Makes sure the signed-in user has a profile, creating a `member` one on first login. An existing
 * profile is returned as it is: the provider's name or picture changing later, or an admin's role,
 * must not be overwritten by a login.
 */
export async function ensureProfile(db: AnyDb, user: AuthUser) {
	const metadata = user.user_metadata ?? {};

	const [created] = await db
		.insert(profiles)
		.values({ id: user.id, displayName: displayNameOf(metadata), avatarUrl: avatarOf(metadata) })
		.onConflictDoNothing()
		.returning();
	if (created) return created;

	const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id));
	return existing;
}
