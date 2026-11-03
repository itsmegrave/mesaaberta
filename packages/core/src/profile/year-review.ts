// Retrospectiva: a person's year at the tables (`/u/<username>/review/<year>`).

/** The first year the platform has a Retrospectiva for. */
export const FIRST_REVIEW_YEAR = 2025;

/** The years there is a Retrospectiva for, against `now`: from the first one to the current one. */
export const isReviewYear = (year: number, now: Date) =>
  Number.isInteger(year) && year >= FIRST_REVIEW_YEAR && year <= now.getUTCFullYear();

/** A year runs in Brasília time: from 1 January 00:00 to the next 1 January 00:00 (UTC-3). */
export const reviewRange = (year: number) => ({
  from: new Date(Date.UTC(year, 0, 1, 3)),
  to: new Date(Date.UTC(year + 1, 0, 1, 3)),
});
