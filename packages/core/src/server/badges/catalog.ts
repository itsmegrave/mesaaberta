import type { EventType } from '@mesaaberta/contracts';
import { and, count, countDistinct, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, partners, ratings, registrations } from '../db/schema';

/** What a rule can ask about one person. Each answer is worked out once, when first asked. */
export type BadgeStats = {
  /** Concluded sessions played as a confirmed player, unless the GM marked the person absent. */
  sessionsPlayed(): Promise<number>;
  /** How many different systems those sessions used. */
  systemsPlayed(): Promise<number>;
  /** Concluded tables the person ran as GM. */
  tablesRun(): Promise<number>;
  /** Concluded in-person tables the person ran, or played unless marked absent. */
  inPersonTables(): Promise<number>;
  ratingsGiven(): Promise<number>;
  /** Whether a partner the person submitted is on the page. */
  hasApprovedPartner(): Promise<boolean>;
};

export type BadgeDefinition = {
  /** Stable and unique: it is stored in `user_badges`. Lowercase words joined by hyphens. */
  id: string;
  /** Badges of one ladder (5, 25, 100 sessions) share it; the higher tier comes later. */
  ladder?: string;
  tier?: number;
  /** The events after which the rule is worth checking. */
  triggers: readonly EventType[];
  /** How far along the person is, in the unit of `goal` (sessions, systems, 0 or 1 ...). */
  measure(stats: BadgeStats): Promise<number>;
  /** The badge is earned once `measure` reaches this. */
  goal: number;
};

/** Whether the person has earned the badge. */
export const meets = async (rule: BadgeDefinition, stats: BadgeStats): Promise<boolean> =>
  (await rule.measure(stats)) >= rule.goal;

const memo = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let pending: Promise<T> | undefined;
  return () => (pending ??= load());
};

export function statsFor(db: AnyDb, profileId: string): BadgeStats {
  // The sessions a person took part in: a seat that was confirmed and not marked absent.
  const played = () =>
    db
      .select({ total: count(), systems: countDistinct(gameTables.systemId) })
      .from(registrations)
      .innerJoin(gameTables, eq(gameTables.id, registrations.tableId))
      .where(
        and(
          eq(registrations.playerId, profileId),
          eq(registrations.status, 'confirmed'),
          eq(gameTables.status, 'concluded'),
          or(isNull(registrations.attended), ne(registrations.attended, false)),
        ),
      );
  const sessions = memo(async () => (await played())[0]);
  return {
    sessionsPlayed: async () => (await sessions()).total,
    systemsPlayed: async () => (await sessions()).systems,
    tablesRun: memo(async () => {
      const [row] = await db
        .select({ total: count() })
        .from(gameTables)
        .where(and(eq(gameTables.gmId, profileId), eq(gameTables.status, 'concluded')));
      return row.total;
    }),
    inPersonTables: memo(async () => {
      const [asPlayer] = await db
        .select({ total: count() })
        .from(registrations)
        .innerJoin(gameTables, eq(gameTables.id, registrations.tableId))
        .where(
          and(
            eq(registrations.playerId, profileId),
            eq(registrations.status, 'confirmed'),
            eq(gameTables.status, 'concluded'),
            eq(gameTables.modality, 'in_person'),
            or(isNull(registrations.attended), ne(registrations.attended, false)),
          ),
        );
      const [asGm] = await db
        .select({ total: count() })
        .from(gameTables)
        .where(
          and(
            eq(gameTables.gmId, profileId),
            eq(gameTables.status, 'concluded'),
            eq(gameTables.modality, 'in_person'),
          ),
        );
      return asPlayer.total + asGm.total;
    }),
    ratingsGiven: memo(async () => {
      const [row] = await db
        .select({ total: count() })
        .from(ratings)
        .where(eq(ratings.playerId, profileId));
      return row.total;
    }),
    hasApprovedPartner: memo(async () => {
      const [row] = await db
        .select({ total: count() })
        .from(partners)
        .where(
          and(
            eq(partners.submitterId, profileId),
            isNotNull(partners.approvedAt),
            isNull(partners.removedAt),
          ),
        );
      return row.total > 0;
    }),
  };
}

const ATTENDANCE: readonly EventType[] = ['TableConcluded'];

const ladder = (
  name: string,
  goals: readonly number[],
  measure: BadgeDefinition['measure'],
): BadgeDefinition[] =>
  goals.map((goal, index) => ({
    id: `${name}-${index + 1}`,
    ladder: name,
    tier: index + 1,
    triggers: ATTENDANCE,
    goal,
    measure,
  }));

/**
 * The badges a rule awards. Manual ones (a grant by an admin) and the Pioneiro (backfill only) are
 * not here. Adding one is safe at any time; renaming or removing an id is not.
 */
export const BADGES: readonly BadgeDefinition[] = [
  { id: 'first-table', triggers: ATTENDANCE, goal: 1, measure: (stats) => stats.sessionsPlayed() },
  ...ladder('regular-player', [5, 25, 100], (stats) => stats.sessionsPlayed()),
  {
    id: 'system-explorer',
    triggers: ATTENDANCE,
    goal: 5,
    measure: (stats) => stats.systemsPlayed(),
  },
  {
    id: 'in-person-table',
    triggers: ATTENDANCE,
    goal: 1,
    measure: (stats) => stats.inPersonTables(),
  },
  {
    id: 'thoughtful-critic',
    triggers: ['RatingSubmitted'],
    goal: 10,
    measure: (stats) => stats.ratingsGiven(),
  },
  { id: 'gm-first', triggers: ATTENDANCE, goal: 1, measure: (stats) => stats.tablesRun() },
  ...ladder('gm-master', [5, 25, 100], (stats) => stats.tablesRun()),
  {
    id: 'partner',
    triggers: ['PartnerApproved'],
    goal: 1,
    measure: async (stats) => ((await stats.hasApprovedPartner()) ? 1 : 0),
  },
];
