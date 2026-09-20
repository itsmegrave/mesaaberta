import { describe, expect, it, vi } from 'vitest';
import { changePassword, requestPasswordReset } from './password';

const origin = 'https://mesaaberta.app';
const log = () => ({
	info: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	child: vi.fn()
});

const fake = (auth: Record<string, unknown>) => {
	const l = log();
	return { deps: { supabase: { auth } as never, log: l }, log: l };
};

describe('requestPasswordReset', () => {
	const input = { email: 'ana@example.com', origin };

	it('asks Supabase to email a link that comes back through our callback and on to the new-password page', async () => {
		const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
		const { deps } = fake({ resetPasswordForEmail });

		await requestPasswordReset(deps, input);

		expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
			redirectTo: `${origin}/auth/callback?next=%2Freset-password`
		});
	});

	it('answers "sent" without saying whether the address has an account (Supabase does not either)', async () => {
		const { deps } = fake({
			resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null })
		});

		expect(await requestPasswordReset(deps, input)).toBe('sent');
	});

	it.each([
		['over_email_send_rate_limit', 'rate_limited'],
		['over_request_rate_limit', 'rate_limited'],
		['something_unexpected', 'failed']
	])('turns the Supabase error %s into %s', async (code, result) => {
		const { deps } = fake({
			resetPasswordForEmail: vi
				.fn()
				.mockResolvedValue({ data: null, error: { code, status: 429, message: 'x' } })
		});

		expect(await requestPasswordReset(deps, input)).toBe(result);
	});

	it('never writes the address to the log, even when the error message quotes it', async () => {
		const { deps, log: l } = fake({
			resetPasswordForEmail: vi.fn().mockResolvedValue({
				data: null,
				error: { code: 'x', status: 500, message: 'could not send to ana@example.com' }
			})
		});

		await requestPasswordReset(deps, input);

		expect(JSON.stringify([l.warn.mock.calls, l.error.mock.calls])).not.toContain(
			'ana@example.com'
		);
	});
});

describe('changePassword', () => {
	const input = { password: 'a brand new password' };
	const ok = () => ({
		updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
		signOut: vi.fn()
	});

	it('sets the new password on the person who opened the link', async () => {
		const auth = ok();
		const { deps } = fake(auth);

		expect(await changePassword(deps, input)).toBe('ok');
		expect(auth.updateUser).toHaveBeenCalledWith({ password: 'a brand new password' });
	});

	it('signs out every other session afterwards, in case whoever knew the old password is still in', async () => {
		const auth = ok();
		const { deps } = fake(auth);

		await changePassword(deps, input);

		expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
	});

	it('still says ok if signing the others out fails, and logs it', async () => {
		const auth = { ...ok(), signOut: vi.fn().mockRejectedValue(new Error('network')) };
		const { deps, log: l } = fake(auth);

		expect(await changePassword(deps, input)).toBe('ok');
		expect(l.warn).toHaveBeenCalled();
	});

	it.each([
		[{ code: 'weak_password' }, 'weak_password'],
		[{ code: 'same_password' }, 'same_password'],
		[{ name: 'AuthSessionMissingError' }, 'no_session'],
		[{ code: 'over_request_rate_limit' }, 'rate_limited'],
		[{ code: 'something_unexpected' }, 'failed']
	])('turns the Supabase error %j into %s', async (error, result) => {
		const { deps } = fake({
			updateUser: vi.fn().mockResolvedValue({
				data: { user: null },
				error: { status: 400, message: 'x', ...error }
			}),
			signOut: vi.fn()
		});

		expect(await changePassword(deps, input)).toBe(result);
	});

	it('does not sign the others out when the change failed', async () => {
		const signOut = vi.fn();
		const { deps } = fake({
			updateUser: vi.fn().mockResolvedValue({
				data: {},
				error: { code: 'weak_password', status: 422, message: 'x' }
			}),
			signOut
		});

		await changePassword(deps, input);

		expect(signOut).not.toHaveBeenCalled();
	});

	it('never writes the password to the log', async () => {
		const { deps, log: l } = fake({
			updateUser: vi.fn().mockResolvedValue({
				data: {},
				error: { code: 'x', status: 500, message: 'password "a brand new password" rejected' }
			}),
			signOut: vi.fn()
		});

		await changePassword(deps, input);

		expect(JSON.stringify([l.warn.mock.calls, l.error.mock.calls])).not.toContain(
			'a brand new password'
		);
	});
});
