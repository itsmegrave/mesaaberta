import { and, eq } from 'drizzle-orm';
import { profiles } from '../db/schema';
import { nextStatus } from '../../tables/lifecycle-machine';
import type { TableStatus } from '../../tables/status';
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
  'admin:access': undefined;
  'table:create': undefined;
  /** A concluded table is frozen: its ratings describe it as it was. */
  'table:edit': { gmId: string; tableStatus: TableStatus };
  'table:disable': { gmId: string; tableStatus: TableStatus };
  /** After the session: say it happened, that it did not, or move it to a new date. */
  'table:confirm': { gmId: string; tableStatus: TableStatus };
  /** The facts a join depends on, read inside the capacity transaction. */
  'table:join': {
    gmId: string;
    tableStatus: TableStatus;
    seatsLeft: number;
    alreadyRegistered: boolean;
  };
  /** Rating a table and its GM: needs a confirmed seat and a session the GM confirmed happened. */
  'table:rate': {
    gmId: string;
    registration: 'pending' | 'confirmed' | null;
    tableStatus: TableStatus;
    firstSessionEnded: boolean;
  };
  /** Approve or decline a request, or remove a player. */
  'registration:manage': { gmId: string };
  /** A player leaving their own registration. */
  'registration:leave': { playerId: string };
  /**
   * Reporting a table, or a player the reporter shares it with. "Shares" means the GM or a
   * confirmed player; `reporterSeated` and `playerSeated` say whether each has a confirmed seat.
   */
  'report:file': {
    gmId: string;
    reporterSeated: boolean;
    target: { type: 'table' } | { type: 'player'; playerId: string; playerSeated: boolean };
  };
  /** The report queue, its decisions and the audit log. */
  'moderation:manage': undefined;
  /** Banning an account or revoking a ban. Never one's own, never another admin's. */
  'account:ban': Pick<Actor, 'id' | 'role'>;
};

export type Action = keyof Resources;

type ResourceArgs<A extends Action> = Resources[A] extends undefined
  ? []
  : [resource: Resources[A]];

const isGmOrAdmin = (actor: Actor, table: { gmId: string } | undefined) =>
  table !== undefined && (actor.role === 'admin' || actor.id === table.gmId);

/** Editing and disabling stop once the GM confirmed the session happened: players rate it then. */
const changeable = (actor: Actor, table: Resources['table:edit'] | undefined) =>
  table !== undefined && table.tableStatus !== 'concluded' && isGmOrAdmin(actor, table);

type JoinFacts = Resources['table:join'];

/**
 * Why this actor may not join, or null if they may. The reasons let the caller answer precisely
 * (a full table is not a permission problem) without deciding anything itself. Checked in order:
 * who may ever join, whether the table takes players, a registration already there, a free seat.
 */
export function joinBlocker(
  actor: Actor | null,
  facts: JoinFacts | undefined,
): 'forbidden' | 'inactive' | 'registered' | 'full' | null {
  if (!actor || actor.status !== 'active' || !facts || actor.id === facts.gmId) return 'forbidden';
  if (facts.tableStatus !== 'active') return 'inactive';
  if (facts.alreadyRegistered) return 'registered';
  if (facts.seatsLeft <= 0) return 'full';

  return null;
}

/**
 * Why this actor may not rate, or null if they may: a confirmed registration, not the GM, and a
 * session the GM confirmed happened (you rate what you played).
 */
export function rateBlocker(
  actor: Actor | null,
  facts: Resources['table:rate'] | undefined,
): 'forbidden' | 'not_registered' | 'too_early' | null {
  if (!actor || actor.status !== 'active' || !facts || actor.id === facts.gmId) return 'forbidden';
  if (facts.registration !== 'confirmed') return 'not_registered';
  // Until the GM says the session happened, there is nothing to rate yet.
  if (!facts.firstSessionEnded || facts.tableStatus !== 'concluded') return 'too_early';

  return null;
}

const rules: { [A in Action]: (actor: Actor, resource: Resources[A]) => boolean } = {
  'admin:access': (actor) => actor.role === 'admin',
  // Any signed-in user can open a table and becomes its GM.
  'table:create': () => true,
  'table:edit': changeable,
  'table:disable': changeable,
  'table:confirm': (actor, table) =>
    table !== undefined &&
    nextStatus(table.tableStatus, 'HAPPENED') !== null &&
    isGmOrAdmin(actor, table),
  'table:join': (actor, facts) => joinBlocker(actor, facts) === null,
  'table:rate': (actor, facts) => rateBlocker(actor, facts) === null,
  'registration:manage': isGmOrAdmin,
  'registration:leave': (actor, registration) =>
    registration !== undefined && actor.id === registration.playerId,
  'report:file': (actor, facts) => {
    if (!facts) return false;
    if (facts.target.type === 'table') return actor.id !== facts.gmId;
    const { playerId, playerSeated } = facts.target;
    const reporterShares = actor.id === facts.gmId || facts.reporterSeated;
    const playerShares = playerId === facts.gmId || playerSeated;
    return playerId !== actor.id && reporterShares && playerShares;
  },
  'moderation:manage': (actor) => actor.role === 'admin',
  'account:ban': (actor, target) =>
    target !== undefined &&
    actor.role === 'admin' &&
    target.id !== actor.id &&
    target.role !== 'admin',
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

/**
 * The profiles `admin:access` lets in, as a query condition, for finding who to tell (a new
 * report). It mirrors the rule above so nothing else has to read a role.
 */
export const activeAdmins = () => and(eq(profiles.role, 'admin'), eq(profiles.status, 'active'));
