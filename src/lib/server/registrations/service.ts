import { and, asc, eq, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations } from '../db/schema';
import { authorize, joinBlocker, type Actor } from '../auth/policy';
import { AlreadyRegistered, Forbidden, NotFound, TableFull } from '../errors';
import { recordEvent } from '../events/outbox';
import type { DomainEvent } from '../events/types';

// Every operation is one transaction. The ones that can change how many seats are taken lock the
// table's row first (`SELECT ... FOR UPDATE`), so two of them on the same table run one after the
// other: the second counts seats after the first has committed. Events are written in the same
// transaction; the caller dispatches them after the commit (see `locals.afterResponse`).

type Tx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];
type RegistrationEvent = Extract<DomainEvent, { payload: { playerId: string } }>;

/** The table row, locked until the transaction ends. */
async function lockTable(tx: Tx, slug: string) {
	const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug)).for('update');
	if (!table) throw new NotFound(`no table with slug "${slug}"`);

	return table;
}

async function confirmedSeats(tx: Tx, tableId: string) {
	const [{ count }] = await tx
		.select({ count: sql<number>`count(*)::int` })
		.from(registrations)
		.where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));

	return count;
}

async function registrationOf(tx: Tx, tableId: string, playerId: string) {
	const [registration] = await tx
		.select()
		.from(registrations)
		.where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)));

	return registration;
}

const asDb = (tx: Tx) => tx as unknown as AnyDb;

const record = (
	tx: Tx,
	actor: Actor,
	table: { id: string; slug: string },
	playerId: string,
	type: Exclude<RegistrationEvent['type'], 'PlayerLeft'>
) =>
	recordEvent(asDb(tx), {
		type,
		actorId: actor.id,
		payload: { tableId: table.id, slug: table.slug, playerId }
	});

/**
 * The signed-in player takes a seat, or asks for one when the GM approves each player. The seat
 * count is read under the table lock, so the last seat goes to exactly one of two racing players.
 */
export async function joinTable(db: AnyDb, actor: Actor | null, slug: string) {
	return db.transaction(async (tx) => {
		const table = await lockTable(tx, slug);
		const seatsLeft = table.capacity - (await confirmedSeats(tx, table.id));
		const existing = actor ? await registrationOf(tx, table.id, actor.id) : undefined;

		const blocker = joinBlocker(actor, {
			gmId: table.gmId,
			tableStatus: table.status,
			seatsLeft,
			alreadyRegistered: existing !== undefined
		});
		if (blocker === 'inactive') throw new NotFound('the table is not active');
		if (blocker === 'registered') throw new AlreadyRegistered();
		if (blocker === 'full') throw new TableFull();
		if (blocker) throw new Forbidden('table:join');

		const status = table.joinMode === 'auto' ? 'confirmed' : 'pending';
		await tx.insert(registrations).values({ tableId: table.id, playerId: actor!.id, status });

		const eventIds = [
			await record(
				tx,
				actor!,
				table,
				actor!.id,
				status === 'confirmed' ? 'PlayerJoined' : 'JoinRequested'
			)
		];
		return { status, eventIds } as const;
	});
}

/** A player gives up their place, or withdraws a request. A pending request took no seat, so it leaves no event. */
export async function leaveTable(db: AnyDb, actor: Actor | null, slug: string) {
	return db.transaction(async (tx) => {
		const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug));
		if (!table) throw new NotFound(`no table with slug "${slug}"`);
		authorize(actor, 'registration:leave', { playerId: actor?.id ?? '' });

		const registration = await registrationOf(tx, table.id, actor!.id);
		if (!registration) throw new NotFound('no registration');

		await tx
			.delete(registrations)
			.where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, actor!.id)));

		if (registration.status === 'pending') return { eventIds: [] as string[] };

		const eventId = await recordEvent(asDb(tx), {
			type: 'PlayerLeft',
			actorId: actor!.id,
			payload: { tableId: table.id, slug: table.slug, playerId: actor!.id, reason: 'left' }
		});
		return { eventIds: [eventId] };
	});
}

/** The GM or an admin confirms a pending request. Fails with `TableFull` when no seat is left. */
export async function approveRegistration(
	db: AnyDb,
	actor: Actor | null,
	slug: string,
	playerId: string
) {
	return db.transaction(async (tx) => {
		const table = await lockTable(tx, slug);
		authorize(actor, 'registration:manage', table);

		const registration = await registrationOf(tx, table.id, playerId);
		if (registration?.status !== 'pending') throw new NotFound('no pending request');
		if ((await confirmedSeats(tx, table.id)) >= table.capacity) throw new TableFull();

		await tx
			.update(registrations)
			.set({ status: 'confirmed' })
			.where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, playerId)));

		return {
			eventIds: [
				await record(tx, actor!, table, playerId, 'JoinApproved'),
				await record(tx, actor!, table, playerId, 'PlayerJoined')
			]
		};
	});
}

/** The GM or an admin turns down a pending request; it is deleted. */
export async function declineRegistration(
	db: AnyDb,
	actor: Actor | null,
	slug: string,
	playerId: string
) {
	return db.transaction(async (tx) => {
		const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug));
		if (!table) throw new NotFound(`no table with slug "${slug}"`);
		authorize(actor, 'registration:manage', table);

		const registration = await registrationOf(tx, table.id, playerId);
		if (registration?.status !== 'pending') throw new NotFound('no pending request');

		await tx
			.delete(registrations)
			.where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, playerId)));

		return { eventIds: [await record(tx, actor!, table, playerId, 'JoinDeclined')] };
	});
}

/** The GM or an admin removes a player who has a seat. */
export async function removePlayer(db: AnyDb, actor: Actor | null, slug: string, playerId: string) {
	return db.transaction(async (tx) => {
		const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug));
		if (!table) throw new NotFound(`no table with slug "${slug}"`);
		authorize(actor, 'registration:manage', table);

		const registration = await registrationOf(tx, table.id, playerId);
		if (registration?.status !== 'confirmed') throw new NotFound('that player has no seat');

		await tx
			.delete(registrations)
			.where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, playerId)));

		const eventId = await recordEvent(asDb(tx), {
			type: 'PlayerLeft',
			actorId: actor!.id,
			payload: { tableId: table.id, slug: table.slug, playerId, reason: 'removed' }
		});
		return { eventIds: [eventId] };
	});
}

/** The players and the requests at a table, with names. Only for the GM and admins: names are not public. */
export async function listRegistrations(db: AnyDb, actor: Actor | null, slug: string) {
	const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
	if (!table) throw new NotFound(`no table with slug "${slug}"`);
	authorize(actor, 'registration:manage', table);

	return db
		.select({
			playerId: registrations.playerId,
			displayName: profiles.displayName,
			status: registrations.status
		})
		.from(registrations)
		.innerJoin(profiles, eq(registrations.playerId, profiles.id))
		.where(eq(registrations.tableId, table.id))
		.orderBy(asc(registrations.createdAt), asc(profiles.displayName));
}

/** A player's own place at a table: `confirmed`, `pending`, or null. */
export async function registrationStatus(db: AnyDb, tableId: string, playerId: string) {
	const [registration] = await db
		.select({ status: registrations.status })
		.from(registrations)
		.where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)));

	return registration?.status ?? null;
}
