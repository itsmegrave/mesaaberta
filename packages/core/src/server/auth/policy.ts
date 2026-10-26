import { and, eq } from 'drizzle-orm';
import { profiles } from '../db/schema';
import { nextStatus } from '../../tables/lifecycle-machine';
import type { TableStatus } from '../../tables/status-values';
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
  'table:duplicate': { gmId: string; moderatedAt: Date | null };
  /** A concluded table is frozen: its ratings describe it as it was. */
  'table:edit': { gmId: string; tableStatus: TableStatus };
  'table:disable': { gmId: string; tableStatus: TableStatus };
  'table:end': { gmId: string };
  /** After the session: say it happened, that it did not, or move it to a new date. */
  'table:confirm': { gmId: string; tableStatus: TableStatus };
  /** A campaign or adventure that went on: the GM ends it, or lets players rate it meanwhile. */
  'table:finish': {
    gmId: string;
    tableStatus: TableStatus;
    kind: 'campaign' | 'one_shot' | 'adventure';
  };
  /** The facts a join depends on, read inside the capacity transaction. */
  'table:join': {
    gmId: string;
    tableStatus: TableStatus;
    /** The session has begun: the status only follows once its duration is over, but seats close now. */
    started: boolean;
    seatsLeft: number;
    alreadyRegistered: boolean;
  };
  /** Rating a table and its GM: needs a confirmed seat and a session the GM confirmed happened. */
  'table:rate': {
    gmId: string;
    registration: 'pending' | 'confirmed' | null;
    tableStatus: TableStatus;
    firstSessionEnded: boolean;
    /** The GM's word on whether the player showed up: only `false` blocks. Null when not recorded. */
    attended?: boolean | null;
    /** The GM let this player rate before the table is concluded. */
    ratingOpened?: boolean;
  };
  /**
   * The GM rating a player of their table: only one the GM marked present (`markedPresent`), and
   * only while a session that happened is behind them (`playerRatingOpen`).
   */
  'player:rate': {
    gmId: string;
    tableStatus: TableStatus;
    kind: 'campaign' | 'one_shot' | 'adventure';
    markedPresent: boolean;
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
  /** Adding a crowdfunding campaign: any signed-in member, public at once. */
  'crowdfunding:add': undefined;
  /** Reporting a campaign. Not one's own: its submitter would be reporting themselves. */
  'crowdfunding:report': { submitterId: string | null };
  /** Sending a partner: any signed-in member. An admin approves it before it is listed. */
  'partner:add': undefined;
  /**
   * Editing or withdrawing a partner, and choosing who looks after it: only those accounts
   * (`ownersOf`: the submitter alone until someone accepts an invite).
   */
  'partner:edit': { ownerIds: readonly string[] };
  /** Reporting a partner. Not one's own: an owner would be reporting themselves. */
  'partner:report': { ownerIds: readonly string[] };
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
 * who may ever join, whether the table takes players (active and not started), a registration
 * already there, a free seat.
 */
export function joinBlocker(
  actor: Actor | null,
  facts: JoinFacts | undefined,
): 'forbidden' | 'inactive' | 'registered' | 'full' | null {
  if (!actor || actor.status !== 'active' || !facts || actor.id === facts.gmId) return 'forbidden';
  if (facts.tableStatus !== 'active' || facts.started) return 'inactive';
  if (facts.alreadyRegistered) return 'registered';
  if (facts.seatsLeft <= 0) return 'full';

  return null;
}

/**
 * Why this actor may not rate, or null if they may: a confirmed registration, not the GM, and a
 * session the GM confirmed happened (you rate what you played). A player the GM marked absent
 * did not play it.
 */
export function rateBlocker(
  actor: Actor | null,
  facts: Resources['table:rate'] | undefined,
): 'forbidden' | 'not_registered' | 'absent' | 'too_early' | null {
  if (!actor || actor.status !== 'active' || !facts || actor.id === facts.gmId) return 'forbidden';
  if (facts.registration !== 'confirmed') return 'not_registered';
  if (facts.attended === false) return 'absent';
  // Until the GM says the session happened, there is nothing to rate yet. A table that goes on can
  // be rated before it ends, by the players the GM let: its date has moved on to the next session,
  // so the GM's word replaces the first-session check.
  const letByGm =
    facts.ratingOpened === true &&
    (facts.tableStatus === 'active' ||
      facts.tableStatus === 'awaiting_confirmation' ||
      facts.tableStatus === 'concluded');
  if (!letByGm && (!facts.firstSessionEnded || facts.tableStatus !== 'concluded'))
    return 'too_early';

  return null;
}

/**
 * Whether a table's GM can rate its players now. A one-shot once the GM said the session happened
 * (concluded); a campaign or adventure also while it goes on, since a player marked present has
 * played a session that happened. A table that did not happen, or was taken down, has nothing to rate.
 */
export const playerRatingOpen = (table: {
  tableStatus: TableStatus;
  kind: 'campaign' | 'one_shot' | 'adventure';
}): boolean =>
  table.tableStatus === 'concluded' ||
  (table.kind !== 'one_shot' &&
    (table.tableStatus === 'active' || table.tableStatus === 'awaiting_confirmation'));

const rules: { [A in Action]: (actor: Actor, resource: Resources[A]) => boolean } = {
  'admin:access': (actor) => actor.role === 'admin',
  // Any signed-in user can open a table and becomes its GM.
  'table:create': () => true,
  'table:duplicate': (actor, table) =>
    Boolean(table && table.gmId === actor.id && !table.moderatedAt),
  'table:edit': changeable,
  'table:disable': changeable,
  'table:end': (actor, table) => Boolean(table && actor.id === table.gmId),
  'table:confirm': (actor, table) =>
    table !== undefined &&
    nextStatus(table.tableStatus, 'HAPPENED') !== null &&
    isGmOrAdmin(actor, table),
  'table:finish': (actor, table) =>
    table !== undefined &&
    table.kind !== 'one_shot' &&
    ['active', 'awaiting_confirmation'].includes(table.tableStatus) &&
    isGmOrAdmin(actor, table),
  'table:join': (actor, facts) => joinBlocker(actor, facts) === null,
  'table:rate': (actor, facts) => rateBlocker(actor, facts) === null,
  // Only the GM: an admin did not play with them.
  'player:rate': (actor, facts) =>
    facts !== undefined &&
    actor.id === facts.gmId &&
    facts.markedPresent &&
    playerRatingOpen(facts),
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
  'crowdfunding:add': () => true,
  'crowdfunding:report': (actor, campaign) =>
    campaign !== undefined && actor.id !== campaign.submitterId,
  'partner:add': () => true,
  'partner:edit': (actor, partner) => partner !== undefined && partner.ownerIds.includes(actor.id),
  'partner:report': (actor, partner) =>
    partner !== undefined && !partner.ownerIds.includes(actor.id),
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
