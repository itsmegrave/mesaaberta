import { z } from 'zod';

/** The longest note an admin writes on a grant or a revocation, as `user_badges` checks it. */
export const BADGE_REASON_MAX = 1000;

/**
 * An admin giving a badge to a person, or taking it away, from `/admin/users/[id]`: the badge by its
 * catalog id, and why, for the audit log.
 */
export const badgeDecisionSchema = z.object({
  profileId: z.uuid(),
  badgeId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  reason: z.string().trim().min(1).max(BADGE_REASON_MAX),
});
export type BadgeDecision = z.output<typeof badgeDecisionSchema>;
