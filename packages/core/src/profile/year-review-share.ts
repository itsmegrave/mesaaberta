import { z } from 'zod';

/** "Deixar pública" / "Deixar só para mim" on a Retrospectiva. */
export const yearReviewShareSchema = z.object({ shared: z.enum(['true', 'false']) });
