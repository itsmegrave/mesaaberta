import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
// The `.ts` extension lets `scripts/make-admin.ts` run this file in plain Node.
import { profiles } from '../db/schema.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Makes an existing profile an admin. There is no admin signup flow on purpose: the first admin is
 * made by whoever runs the deploy, with `pnpm db:make-admin <user id>`. Returns false when the
 * person has no profile yet (they must sign in once first).
 */
export async function promoteToAdmin(db: AnyDb, userId: string): Promise<boolean> {
	if (!UUID.test(userId)) throw new Error('That is not a user id: expected a UUID.');

	const updated = await db
		.update(profiles)
		.set({ role: 'admin' })
		.where(eq(profiles.id, userId))
		.returning({ id: profiles.id });

	return updated.length > 0;
}
