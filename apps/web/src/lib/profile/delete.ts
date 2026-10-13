import '$lib/forms/zod-codes';
import { z } from 'zod';

/** Closing the account: the person types their @username to confirm. The server compares it. */
export const deleteAccountSchema = z.object({ confirm: z.string().trim().toLowerCase().max(100) });
