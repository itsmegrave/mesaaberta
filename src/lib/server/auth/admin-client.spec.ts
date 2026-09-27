import { describe, expect, it, vi } from 'vitest';
import { deleteAuthUser, emailOf, supabaseAdminFrom, type SupabaseAdmin } from './admin-client';

const client = (result: {
	user: { email?: string | null } | null;
	error?: string | null;
}): SupabaseAdmin => ({
	auth: {
		admin: {
			getUserById: vi.fn(async () => ({
				data: { user: result.user },
				error: result.error ? { message: result.error } : null
			})),
			deleteUser: vi.fn(async () => ({
				error: result.error ? { message: result.error } : null
			}))
		}
	}
});

describe('emailOf', () => {
	it('returns only the email from the narrowly scoped Admin client', async () => {
		const admin = client({ user: { email: 'ana@example.com' } });
		await expect(emailOf(admin, 'user-id')).resolves.toBe('ana@example.com');
		expect(admin.auth.admin.getUserById).toHaveBeenCalledWith('user-id');
	});

	it.each([
		[{ user: null }, /no email/i],
		[{ user: { email: '' } }, /no email/i],
		[{ user: { email: 'ana@example.com' }, error: 'denied' }, /denied/]
	])('rejects an unavailable or invalid Admin result', async (result, message) => {
		await expect(emailOf(client(result), 'user-id')).rejects.toThrow(message);
	});
});

describe('deleteAuthUser', () => {
	it('deletes the user by id', async () => {
		const admin = client({ user: null });
		await deleteAuthUser(admin, 'user-id');
		expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('user-id');
	});

	it('fails loudly when Supabase refuses, so the account is not reported as deleted', async () => {
		await expect(
			deleteAuthUser(client({ user: null, error: 'denied' }), 'user-id')
		).rejects.toThrow(/denied/);
	});
});

describe('supabaseAdminFrom', () => {
	it('needs the URL and a secret key, under either name', () => {
		expect(supabaseAdminFrom(undefined)).toBeNull();
		expect(supabaseAdminFrom({ SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
		expect(
			supabaseAdminFrom({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })
		).not.toBeNull();
	});
});
