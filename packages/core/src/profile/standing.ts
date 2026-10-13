/**
 * How an account stands, as an admin reads it. The database has two states (`active` and
 * `suspended`); a suspended account is there because of a ban, and a ban that never ends is a ban
 * ("Banido"), while one with an end date is a suspension ("Suspenso"). A closed account is suspended
 * with no ban on it.
 */
export const PROFILE_STANDINGS = ['active', 'suspended', 'banned'] as const;
export type ProfileStanding = (typeof PROFILE_STANDINGS)[number];

export function standingOf(profile: {
  status: 'active' | 'suspended';
  bannedAt: Date | null;
  bannedUntil: Date | null;
}): ProfileStanding {
  if (profile.status === 'active') return 'active';
  return profile.bannedAt !== null && profile.bannedUntil === null ? 'banned' : 'suspended';
}
