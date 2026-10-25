import '@mesaaberta/core/forms/zod-codes';
import { z } from 'zod';
import { next } from '#lib/forms/next.js';

/**
 * Open, read and read all: which notification (none for read all), where to come back to, and for
 * read all when the page was loaded (what arrived after it stays unread).
 */
export const notificationActionSchema = z.object({
  id: z.guid().optional(),
  next,
  until: z.iso.datetime().optional(),
});
