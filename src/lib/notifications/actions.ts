import '$lib/forms/zod-codes';
import { z } from 'zod';
import { next } from '$lib/forms/next';

/** Open, read and read all: which notification (none for read all), and where to come back to. */
export const notificationActionSchema = z.object({ id: z.guid().optional(), next });
