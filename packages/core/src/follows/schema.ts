import { z } from 'zod';

z.config({ jitless: true });

/** People in one page of "Seguindo". */
export const FOLLOWING_PAGE_SIZE = 20;

/** The Seguir / Seguindo button: who, and whether to follow (`true`) or stop (`false`). */
export const followSchema = z.object({
  profileId: z.string().uuid(),
  follow: z.enum(['true', 'false']),
});

/** "Me avise no sininho quando alguém que eu sigo": abrir uma mesa, abrir vaga numa mesa cheia. */
export const followNoticesSchema = z.object({ tables: z.boolean(), seats: z.boolean() });

export type FollowInput = z.infer<typeof followSchema>;
export type FollowNoticesInput = z.infer<typeof followNoticesSchema>;
