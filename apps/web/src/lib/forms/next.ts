import { z } from 'zod';

/** Where a button-only form comes back to. The server still passes it through `safeNext`. */
export const next = z.string().max(2000).default('');
