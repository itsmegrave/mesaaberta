import type { ProfileStatus } from '@mesaaberta/db/profile-status';

/**
 * How an account stands, as an admin reads it: active, suspended (a temporary ban, with an end
 * date), banned (a ban that never ends) or closed (its owner closed it). It is the profile's status,
 * except for rows written before `banned` and `closed` existed: those are all `suspended`, and their
 * ban fields tell them apart (no ban: closed; a ban with no end: banned). Drop that fallback once
 * the backfill migration has run.
 */
export const PROFILE_STANDINGS = ['active', 'suspended', 'banned', 'closed'] as const;
export type ProfileStanding = (typeof PROFILE_STANDINGS)[number];

export function standingOf(profile: {
  status: ProfileStatus;
  bannedAt: Date | null;
  bannedUntil: Date | null;
}): ProfileStanding {
  if (profile.status !== 'suspended') return profile.status;
  if (profile.bannedAt === null) return 'closed';
  return profile.bannedUntil === null ? 'banned' : 'suspended';
}
