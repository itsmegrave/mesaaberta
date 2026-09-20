import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt, which Supabase uses for passwords, ignores everything after 72 bytes: a longer password
// would be silently shortened, so it is refused instead.
export const MAX_PASSWORD_LENGTH = 72;

const form = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email()),
	// Not trimmed: spaces are part of what the person chose.
	password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH)
});

export type Credentials = z.infer<typeof form>;

/** Validates the sign-up and sign-in forms. Never returns the password inside an error. */
export function parseCredentials(
	data: FormData
): { ok: true; data: Credentials } | { ok: false; errors: { email?: string; password?: string } } {
	const parsed = form.safeParse(Object.fromEntries(data));
	if (parsed.success) return { ok: true, data: parsed.data };

	const errors: Record<string, string> = {};
	for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.code;
	return { ok: false, errors };
}

const emailForm = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });

/** Validates the "forgot my password" form: just an email. */
export function parseEmail(
	data: FormData
): { ok: true; data: { email: string } } | { ok: false; errors: { email?: string } } {
	const parsed = emailForm.safeParse(Object.fromEntries(data));
	if (parsed.success) return { ok: true, data: parsed.data };

	return { ok: false, errors: { email: parsed.error.issues[0].code } };
}

const newPasswordForm = z
	.object({
		password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
		passwordConfirm: z.string()
	})
	.superRefine((value, ctx) => {
		if (value.password !== value.passwordConfirm) {
			ctx.addIssue({ code: 'custom', message: 'mismatch', path: ['passwordConfirm'] });
		}
	});

/** Validates the "choose a new password" form: 8 to 72 characters, typed twice the same way. */
export function parseNewPassword(
	data: FormData
):
	| { ok: true; data: { password: string } }
	| { ok: false; errors: { password?: string; passwordConfirm?: string } } {
	const parsed = newPasswordForm.safeParse(Object.fromEntries(data));
	if (parsed.success) return { ok: true, data: { password: parsed.data.password } };

	const errors: Record<string, string> = {};
	for (const issue of parsed.error.issues) {
		errors[String(issue.path[0])] ??= issue.code === 'custom' ? issue.message : issue.code;
	}
	return { ok: false, errors };
}
