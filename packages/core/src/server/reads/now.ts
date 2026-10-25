const MINUTE_MS = 60_000;

/**
 * The `now` the public lists (`preview`, `tables`) query with: the current time rounded down to the
 * minute. Hyperdrive caches a read by its SQL and parameters, so a millisecond timestamp made every
 * request a cache miss; a minute lets visitors in the same minute share one answer. The cost is
 * that a table can stay listed for up to a minute after it starts. Reads tied to a person (detail,
 * dashboard, manage) keep the exact time.
 */
export const publicReadNow = (at: Date = new Date()) =>
  new Date(Math.floor(at.getTime() / MINUTE_MS) * MINUTE_MS);
