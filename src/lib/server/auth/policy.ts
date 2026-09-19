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
};

export type Action = keyof Resources;

type ResourceArgs<A extends Action> = Resources[A] extends undefined
	? []
	: [resource: Resources[A]];

const isGmOrAdmin = (actor: Actor, table: Resources['table:edit'] | undefined) =>
	table !== undefined && (actor.role === 'admin' || actor.id === table.gmId);

const rules: { [A in Action]: (actor: Actor, resource: Resources[A]) => boolean } = {
	// Any signed-in user can open a table and becomes its GM.
	'table:create': () => true,
	'table:edit': isGmOrAdmin,
	'table:disable': isGmOrAdmin
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
