/** How far ahead "Começa já" looks. */
export const STARTING_SOON_HOURS = 6;
/** The most tables it shows. */
export const STARTING_SOON_COUNT = 3;

/**
 * "Começa já": the tables that start within `STARTING_SOON_HOURS` and still have a seat, soonest
 * first, at most `STARTING_SOON_COUNT`. A last seat on short notice is the one most likely to stay
 * empty, so it gets its own row at the top of the list.
 */
export function startingSoon<T extends { startsAt: Date | null; seatsLeft: number }>(
  tables: readonly T[],
  now: Date,
): T[] {
  const until = now.getTime() + STARTING_SOON_HOURS * 60 * 60 * 1000;
  return tables
    .filter(
      (table) =>
        table.seatsLeft > 0 &&
        table.startsAt !== null &&
        table.startsAt.getTime() > now.getTime() &&
        table.startsAt.getTime() <= until,
    )
    .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime())
    .slice(0, STARTING_SOON_COUNT);
}
