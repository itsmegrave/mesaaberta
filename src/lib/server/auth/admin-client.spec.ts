import { describe, expect, it, vi } from 'vitest';
import { emailOf, type SupabaseAdmin } from './admin-client';

const client = (result: {
	user: { email?: string | null } | null;
	error?: string | null;
}): SupabaseAdmin => ({
	auth: {
		admin: {
			getUserById: vi.fn(async () => ({
				data: { user: result.user },
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
