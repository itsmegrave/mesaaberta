import { and, asc, eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
	gameTables,
	profileSocialLinks,
	profiles,
	ratings,
	registrations,
	systems
} from '../db/schema';
import { recordEvent } from '../events/outbox';

/**
 * Everything the account holds, for the data portability right (LGPD art. 18, V). Only this
 * person's data: the players at their tables are left out, they are other people's data.
 */
export async function exportAccount(db: AnyDb, userId: string, email: string, now = new Date()) {
	const [profile] = await db
		.select({
			username: profiles.username,
			name: profiles.name,
			age: profiles.age,
			gender: profiles.gender,
			city: profiles.city,
			avatarUrl: profiles.avatarUrl,
			createdAt: profiles.createdAt
		})
		.from(profiles)
		.where(eq(profiles.id, userId));

	const [socialLinks, tablesAsGm, seats, ratingsGiven] = await Promise.all([
		db
			.select({ network: profileSocialLinks.network, url: profileSocialLinks.url })
			.from(profileSocialLinks)
			.where(eq(profileSocialLinks.profileId, userId))
			.orderBy(asc(profileSocialLinks.position)),
		db
			.select({
				slug: gameTables.slug,
				title: gameTables.title,
				system: systems.name,
				kind: gameTables.kind,
				status: gameTables.status,
				description: gameTables.description,
				extraInfo: gameTables.extraInfo,
				welcomeMessage: gameTables.welcomeMessage,
				capacity: gameTables.capacity,
				joinMode: gameTables.joinMode,
				startsAt: gameTables.startsAt,
				durationMinutes: gameTables.durationMinutes,
				timezone: gameTables.timezone,
				recurrence: gameTables.recurrence,
				until: gameTables.until,
				createdAt: gameTables.createdAt
			})
			.from(gameTables)
			.innerJoin(systems, eq(gameTables.systemId, systems.id))
			.where(eq(gameTables.gmId, userId))
			.orderBy(asc(gameTables.createdAt)),
		db
			.select({
				table: gameTables.title,
				slug: gameTables.slug,
				status: registrations.status,
				createdAt: registrations.createdAt
			})
			.from(registrations)
			.innerJoin(gameTables, eq(registrations.tableId, gameTables.id))
			.where(eq(registrations.playerId, userId))
			.orderBy(asc(registrations.createdAt)),
		db
			.select({
				table: gameTables.title,
				slug: gameTables.slug,
				tableScore: ratings.tableScore,
				gmScore: ratings.gmScore,
				comment: ratings.comment,
				createdAt: ratings.createdAt
			})
			.from(ratings)
			.innerJoin(gameTables, eq(ratings.tableId, gameTables.id))
			.where(eq(ratings.playerId, userId))
			.orderBy(asc(ratings.createdAt))
	]);

	return {
		exportedAt: now.toISOString(),
		account: { id: userId, email },
		profile: profile ?? null,
		socialLinks,
		tablesAsGm,
		seats,
		ratingsGiven
	};
}

/**
 * The database side of deleting an account, in one transaction: the person's active tables are
 * disabled (each with a `TableDisabled` event, so the players get the calendar cancellation), and
 * their seats go, taking their ratings with them (cascade). Returns the events to dispatch. Run it
 * before the Auth user is deleted: the cancellation mail looks up the GM's address.
 */
export async function closeAccount(db: AnyDb, userId: string): Promise<{ eventIds: string[] }> {
	const eventIds = await db.transaction(async (tx) => {
		const t = tx as unknown as AnyDb;
		const active = await t
			.select({
				id: gameTables.id,
				slug: gameTables.slug,
				title: gameTables.title,
				icalSequence: gameTables.icalSequence
			})
			.from(gameTables)
			.where(and(eq(gameTables.gmId, userId), eq(gameTables.status, 'active')));

		const ids: string[] = [];
		for (const table of active) {
			await t
				.update(gameTables)
				.set({ status: 'disabled', icalSequence: table.icalSequence + 1 })
				.where(eq(gameTables.id, table.id));
			ids.push(
				await recordEvent(t, {
					type: 'TableDisabled',
					actorId: userId,
					payload: { tableId: table.id, slug: table.slug, title: table.title }
				})
			);
		}

		await t.delete(registrations).where(eq(registrations.playerId, userId));
		return ids;
	});

	return { eventIds };
}

/**
 * Clears every personal field of a closed account and its links. The row itself stays, empty, because
 * the disabled tables still point at it; it is suspended so nothing can act through it.
 */
export async function anonymiseProfile(db: AnyDb, userId: string) {
	await db.transaction(async (tx) => {
		await tx.delete(profileSocialLinks).where(eq(profileSocialLinks.profileId, userId));
		await tx
			.update(profiles)
			.set({
				username: null,
				name: null,
				age: null,
				gender: null,
				city: null,
				avatarUrl: null,
				status: 'suspended'
			})
			.where(eq(profiles.id, userId));
	});
}
