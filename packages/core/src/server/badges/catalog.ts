import type { EventType } from '@mesaaberta/contracts';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  crowdfundings,
  events,
  gameTables,
  partners,
  platforms,
  profiles,
  ratings,
  registrations,
  reports,
  systems,
  tags,
} from '../db/schema';
import { gmRatings } from '../ratings/service';

/** What a rule can ask about one person. Each answer is worked out once, when first asked. */
export type BadgeStats = {
  /**
   * The person and the database the rule reads, for a rule that asks something the questions below
   * do not, such as an extension's badge reading its own tables.
   */
  readonly person: { readonly db: AnyDb; readonly profileId: string };
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
  /** Whether the person is among the first `FIRST_MEMBERS` to finish signing up, by signup date. */
  joinedEarly(): Promise<boolean>;
  /** Concluded one-shots played, counted like `sessionsPlayed`. */
  oneShotsPlayed(): Promise<number>;
  /** The GM's score and how many ratings it rests on (`gmRatings`). */
  gmRating(): Promise<{ score: number | null; count: number }>;
  /** Concluded tables the person ran with every seat taken by a confirmed player. */
  fullTablesRun(): Promise<number>;
  /** How many different systems the concluded tables the person ran used. */
  systemsRun(): Promise<number>;
  /** Different people who played at a concluded table the person ran, unless marked absent. */
  playersWelcomed(): Promise<number>;
  /** The person's reports that an admin accepted (resolved, not dismissed). */
  reportsUpheld(): Promise<number>;
  /** Crowdfunding campaigns the person added that are still up. */
  campaignsAdded(): Promise<number>;
  /** Platforms, tags and systems the person suggested that an admin approved. */
  catalogApproved(): Promise<number>;
  /**
   * The person's latest tables as GM that went ahead, in a row: counted back from the newest
   * finished one until a table that did not happen or was cancelled.
   */
  tablesKeptInARow(): Promise<number>;
  /**
   * Whether the last `RELIABLE_MONTHS` hold anything against the person as a player: a no-show
   * report an admin accepted, or a GM removing them from a table.
   */
  recentlyUnreliable(): Promise<boolean>;
};

/** How many members the "100!" badge (once "Primeira centena") goes to. */
export const FIRST_MEMBERS = 100;

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
  /** Not something to work toward: it is left out of the owner's progress list. */
  unlisted?: boolean;
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
    person: { db, profileId },
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
    joinedEarly: memo(async () => {
      const [me] = await db
        .select({ createdAt: profiles.createdAt, username: profiles.username })
        .from(profiles)
        .where(eq(profiles.id, profileId));
      if (!me?.username) return false;
      // Whoever finished signing up before this person, the earlier id first on the same instant.
      const [before] = await db
        .select({ total: count() })
        .from(profiles)
        .where(
          and(
            isNotNull(profiles.username),
            or(
              lt(profiles.createdAt, me.createdAt),
              and(eq(profiles.createdAt, me.createdAt), lt(profiles.id, profileId)),
            ),
          ),
        );
      return before.total < FIRST_MEMBERS;
    }),
    oneShotsPlayed: memo(async () => {
      const [row] = await db
        .select({ total: count() })
        .from(registrations)
        .innerJoin(gameTables, eq(gameTables.id, registrations.tableId))
        .where(
          and(
            eq(registrations.playerId, profileId),
            eq(registrations.status, 'confirmed'),
            eq(gameTables.status, 'concluded'),
            eq(gameTables.kind, 'one_shot'),
            or(isNull(registrations.attended), ne(registrations.attended, false)),
          ),
        );
      return row.total;
    }),
    gmRating: memo(async () => {
      const rating = (await gmRatings(db, [profileId])).get(profileId);
      return { score: rating?.score ?? null, count: rating?.count ?? 0 };
    }),
    fullTablesRun: memo(async () => {
      const confirmed = db
        .select({ total: count() })
        .from(registrations)
        .where(
          and(eq(registrations.tableId, gameTables.id), eq(registrations.status, 'confirmed')),
        );
      const [row] = await db
        .select({ total: count() })
        .from(gameTables)
        .where(
          and(
            eq(gameTables.gmId, profileId),
            eq(gameTables.status, 'concluded'),
            sql`${gameTables.capacity} <= (${confirmed})`,
          ),
        );
      return row.total;
    }),
    systemsRun: memo(async () => {
      const [row] = await db
        .select({ total: countDistinct(gameTables.systemId) })
        .from(gameTables)
        .where(and(eq(gameTables.gmId, profileId), eq(gameTables.status, 'concluded')));
      return row.total;
    }),
    playersWelcomed: memo(async () => {
      const [row] = await db
        .select({ total: countDistinct(registrations.playerId) })
        .from(registrations)
        .innerJoin(gameTables, eq(gameTables.id, registrations.tableId))
        .where(
          and(
            eq(gameTables.gmId, profileId),
            eq(gameTables.status, 'concluded'),
            eq(registrations.status, 'confirmed'),
            ne(registrations.playerId, profileId),
            or(isNull(registrations.attended), ne(registrations.attended, false)),
          ),
        );
      return row.total;
    }),
    reportsUpheld: memo(async () => {
      const [row] = await db
        .select({ total: count() })
        .from(reports)
        .where(and(eq(reports.reporterId, profileId), eq(reports.status, 'resolved')));
      return row.total;
    }),
    campaignsAdded: memo(async () => {
      const [row] = await db
        .select({ total: count() })
        .from(crowdfundings)
        .where(and(eq(crowdfundings.submitterId, profileId), isNull(crowdfundings.removedAt)));
      return row.total;
    }),
    catalogApproved: memo(async () => {
      const approved = await Promise.all(
        [platforms, tags, systems].map(async (table) => {
          const [row] = await db
            .select({ total: count() })
            .from(table)
            .where(and(eq(table.suggestedBy, profileId), eq(table.status, 'approved')));
          return row.total;
        }),
      );
      return approved.reduce((sum, total) => sum + total, 0);
    }),
    tablesKeptInARow: memo(async () => {
      // Enough rows to tell a run that reaches the goal; a longer one changes nothing.
      const latest = await db
        .select({ status: gameTables.status })
        .from(gameTables)
        .where(
          and(
            eq(gameTables.gmId, profileId),
            inArray(gameTables.status, ['concluded', 'not_held', 'disabled']),
          ),
        )
        .orderBy(desc(gameTables.startsAt), desc(gameTables.id))
        .limit(KEPT_IN_A_ROW);
      const broken = latest.findIndex((table) => table.status !== 'concluded');
      return broken === -1 ? latest.length : broken;
    }),
    recentlyUnreliable: memo(async () => {
      const since = new Date(Date.now() - RELIABLE_MONTHS * 30 * 24 * 60 * 60 * 1000);
      const [noShow] = await db
        .select({ total: count() })
        .from(reports)
        .where(
          and(
            eq(reports.targetType, 'player'),
            eq(reports.targetId, profileId),
            eq(reports.reason, 'no_show'),
            eq(reports.status, 'resolved'),
            sql`${reports.createdAt} >= ${since}`,
          ),
        );
      const [removed] = await db
        .select({ total: count() })
        .from(events)
        .where(
          and(
            eq(events.type, 'PlayerLeft'),
            sql`${events.payload}->>'playerId' = ${profileId}`,
            sql`${events.payload}->>'reason' = 'removed'`,
            sql`${events.createdAt} >= ${since}`,
          ),
        );
      return noShow.total > 0 || removed.total > 0;
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

/** How far back a no-show report keeps the "Presença confiável" away. */
const RELIABLE_MONTHS = 6;
/** How many tables in a row the "Palavra cumprida" asks. */
const KEPT_IN_A_ROW = 10;
/** The "Mestragem querida": a score of at least this, from at least `BELOVED_RATINGS` ratings. */
const BELOVED_SCORE = 4.5;
const BELOVED_RATINGS = 10;

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

/** Given only by a backfill, to who joined before the feature was released. */
export const PIONEER_BADGE = 'pioneer';

/** Given only by an admin, from the user's admin page: no rule awards them. */
export const MANUAL_BADGES: readonly string[] = ['community-helper'];

/**
 * The badges a rule awards. Manual ones (a grant by an admin) and the Pioneiro (backfill only) are
 * not here, nor the extensions' (`ruleBadges` adds them). Adding one is safe at any time; renaming
 * or removing an id is not.
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
    id: 'first-100',
    triggers: ['ProfileUpdated'],
    goal: 1,
    unlisted: true,
    measure: async (stats) => ((await stats.joinedEarly()) ? 1 : 0),
  },
  {
    id: 'partner',
    triggers: ['PartnerApproved'],
    goal: 1,
    measure: async (stats) => ((await stats.hasApprovedPartner()) ? 1 : 0),
  },
  // Phase 2.
  {
    id: 'one-shot-adventurer',
    triggers: ATTENDANCE,
    goal: 10,
    measure: (stats) => stats.oneShotsPlayed(),
  },
  {
    id: 'beloved-gm',
    triggers: ['RatingSubmitted'],
    goal: 1,
    // Not a count to work toward: the score moves both ways, so it is left out of the progress list.
    unlisted: true,
    measure: async (stats) => {
      const { score, count } = await stats.gmRating();
      return score !== null && score >= BELOVED_SCORE && count >= BELOVED_RATINGS ? 1 : 0;
    },
  },
  { id: 'full-table', triggers: ATTENDANCE, goal: 5, measure: (stats) => stats.fullTablesRun() },
  { id: 'wandering-gm', triggers: ATTENDANCE, goal: 3, measure: (stats) => stats.systemsRun() },
  { id: 'open-door', triggers: ATTENDANCE, goal: 25, measure: (stats) => stats.playersWelcomed() },
  {
    id: 'word-kept',
    triggers: ATTENDANCE,
    goal: KEPT_IN_A_ROW,
    measure: (stats) => stats.tablesKeptInARow(),
  },
  {
    id: 'table-guardian',
    triggers: ['ReportResolved'],
    goal: 3,
    measure: (stats) => stats.reportsUpheld(),
  },
  {
    id: 'promoter',
    triggers: ['CrowdfundingAdded'],
    goal: 3,
    measure: (stats) => stats.campaignsAdded(),
  },
  {
    id: 'reliable-player',
    triggers: ATTENDANCE,
    goal: 10,
    // Short of the goal while anything recent stands against the person, whatever they played.
    measure: async (stats) => {
      const sessions = await stats.sessionsPlayed();
      return (await stats.recentlyUnreliable()) ? Math.min(sessions, 9) : sessions;
    },
  },
  {
    id: 'curator',
    triggers: ['CatalogEntryApproved'],
    goal: 1,
    measure: (stats) => stats.catalogApproved(),
  },
];
