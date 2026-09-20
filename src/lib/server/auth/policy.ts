import type { profiles } from '../db/schema';
import { Forbidden } from '../errors';

/**
 * The single place that decides who may do what. Routes and modules ask `can` or `authorize`;
 * none of them compares roles or owners itself (ESLint forbids reading `.role` elsewhere).
 * Deny by default: an unknown action, a missing resource and every suspended account are refused.
 *
 * It is pure: no database and no request, only the facts it is handed. Load the actor with
 * `locals.getProfile()`.
 */
export type Actor = Pick<typeof profiles.$inferSelect, 'id' | 'role' | 'status'>;

/** What each action needs to know about the thing it acts on. Add the next action here. */
type Resources = {
	'table:create': undefined;
	'table:edit': { gmId: string };
	'table:disable': { gmId: string };
	/** The facts a join depends on, read inside the capacity transaction. */
	'table:join': {
		gmId: string;
		tableStatus: 'active' | 'disabled';
		seatsLeft: number;
		alreadyRegistered: boolean;
	};
	/** Rating a table and its GM: needs a confirmed seat and a first session that has ended. */
	'table:rate': {
		gmId: string;
		registration: 'pending' | 'confirmed' | null;
		firstSessionEnded: boolean;
	};
	/** Approve or decline a request, or remove a player. */
	'registration:manage': { gmId: string };
	/** A player leaving their own registration. */
	'registration:leave': { playerId: string };
};

export type Action = keyof Resources;

type ResourceArgs<A extends Action> = Resources[A] extends undefined
	? []
	: [resource: Resources[A]];

const isGmOrAdmin = (actor: Actor, table: Resources['table:edit'] | undefined) =>
	table !== undefined && (actor.role === 'admin' || actor.id === table.gmId);

type JoinFacts = Resources['table:join'];

/**
 * Why this actor may not join, or null if they may. The reasons let the caller answer precisely
 * (a full table is not a permission problem) without deciding anything itself. Checked in order:
 * who may ever join, whether the table takes players, a registration already there, a free seat.
 */
export function joinBlocker(
	actor: Actor | null,
	facts: JoinFacts | undefined
): 'forbidden' | 'inactive' | 'registered' | 'full' | null {
	if (!actor || actor.status !== 'active' || !facts || actor.id === facts.gmId) return 'forbidden';
	if (facts.tableStatus !== 'active') return 'inactive';
	if (facts.alreadyRegistered) return 'registered';
	if (facts.seatsLeft <= 0) return 'full';

	return null;
}

/**
 * Why this actor may not rate, or null if they may: a confirmed registration, not the GM, and the
 * first session has ended (you rate what you played).
 */
export function rateBlocker(
	actor: Actor | null,
	facts: Resources['table:rate'] | undefined
): 'forbidden' | 'not_registered' | 'too_early' | null {
	if (!actor || actor.status !== 'active' || !facts || actor.id === facts.gmId) return 'forbidden';
	if (facts.registration !== 'confirmed') return 'not_registered';
	if (!facts.firstSessionEnded) return 'too_early';

	return null;
}

const rules: { [A in Action]: (actor: Actor, resource: Resources[A]) => boolean } = {
	// Any signed-in user can open a table and becomes its GM.
	'table:create': () => true,
	'table:edit': isGmOrAdmin,
	'table:disable': isGmOrAdmin,
	'table:join': (actor, facts) => joinBlocker(actor, facts) === null,
	'table:rate': (actor, facts) => rateBlocker(actor, facts) === null,
	'registration:manage': isGmOrAdmin,
	'registration:leave': (actor, registration) =>
		registration !== undefined && actor.id === registration.playerId
};

export function can<A extends Action>(
	actor: Actor | null,
	action: A,
	...[resource]: ResourceArgs<A>
): boolean {
	if (!actor || actor.status !== 'active') return false;
	if (!Object.hasOwn(rules, action)) return false;

	return rules[action](actor, resource as Resources[A]);
}

/** `can`, as an exception: throws `Forbidden` (see `failFrom`) when the action is not allowed. */
export function authorize<A extends Action>(
	actor: Actor | null,
	action: A,
	...args: ResourceArgs<A>
): void {
	if (!can(actor, action, ...args)) throw new Forbidden(action);
}
