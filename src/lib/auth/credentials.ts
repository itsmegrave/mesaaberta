import '$lib/forms/zod-codes';
import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt, which Supabase uses for passwords, ignores everything after 72 bytes: a longer password
// would be silently shortened, so it is refused instead.
export const MAX_PASSWORD_LENGTH = 72;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
// Not trimmed: spaces are part of what the person chose.
const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

/** Sign-in and sign-up: an email and a password, and where to go afterwards. */
export const credentialsSchema = z.object({
	email,
	password,
	next: z.string().max(2000).default('')
});

/** "Forgot my password": just an email. */
export const emailSchema = z.object({ email });

/** "Choose a new password": 8 to 72 characters, typed twice the same way. */
export const newPasswordSchema = z
	.object({ password, passwordConfirm: z.string() })
	.refine((value) => value.password === value.passwordConfirm, {
		message: 'mismatch',
		path: ['passwordConfirm']
	});

export type CredentialsData = z.output<typeof credentialsSchema>;
