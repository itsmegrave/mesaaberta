import '@mesaaberta/core/forms/zod-codes';
import { z } from 'zod';

/** Hiding a badge from the profile, or showing it again: which one, and which way. */
export const badgeVisibilitySchema = z.object({
  badgeId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  hidden: z.enum(['0', '1']),
});
