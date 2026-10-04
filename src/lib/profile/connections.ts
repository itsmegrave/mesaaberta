import '$lib/forms/zod-codes';
import { z } from 'zod';
import { providers } from '$lib/auth/providers';

/** Disconnecting a provider from the account: which one. The server checks it is not the last way in. */
export const disconnectSchema = z.object({ provider: z.enum(providers) });
