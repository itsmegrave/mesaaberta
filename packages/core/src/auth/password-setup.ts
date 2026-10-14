import '@mesaaberta/core/forms/zod-codes';
import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt, which Supabase uses for passwords, ignores everything after 72 bytes: a longer password
// would be silently shortened, so it is refused instead.
export const MAX_PASSWORD_LENGTH = 72;
export const PASSWORD_CODE_LENGTH = 6;

/** What the api decides on: the new password and the code that was e-mailed to the person. */
export const addPasswordSchema = z.object({
  // Not trimmed: spaces are part of what the person chose.
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

/** The form: the same two fields and the password typed twice the same way. */
export const addPasswordFormSchema = addPasswordSchema
  .extend({ passwordConfirm: z.string() })
  .refine((value) => value.password === value.passwordConfirm, {
    message: 'mismatch',
    path: ['passwordConfirm'],
  });
