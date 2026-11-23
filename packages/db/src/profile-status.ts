/**
 * Where an account stands. `suspended` is a temporary ban (it has `bannedUntil` and is lifted when
 * that time comes), `banned` is a ban with no end, and `closed` is an account its owner closed (it
 * is anonymised and never comes back). The ban's details stay in `bannedAt`, `bannedUntil` and
 * `banReason`.
 *
 * Rows written before `banned` and `closed` existed are all `suspended`; until the backfill runs,
 * read them through `standingOf` (`@mesaaberta/core/profile/standing`), which tells them apart by
 * their ban fields.
 */
export const PROFILE_STATUSES = ['active', 'suspended', 'banned', 'closed'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];
