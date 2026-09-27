import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

const setup = (over: { user?: boolean; updateUser?: object } = {}) => {
	const auth = {
		updateUser: vi.fn().mockResolvedValue(over.updateUser ?? { data: { user: {} }, error: null }),
		signOut: vi.fn()
	};
	const locals = {
		getUser: async () => (over.user === false ? null : { id: 'u1' }),
		supabase: { auth },
		log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() }
	};
	const event = (fields: Record<string, string> = {}, search = '') => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		const url = new URL(`https://x.test/reset-password${search}`);
		return {
			locals,
			url,
			request: new Request(url, { method: 'POST', body })
		} as unknown as RequestEvent;
	};

	return { auth, event };
};

const submit = (event: RequestEvent) =>
	(actions as Record<string, (e: RequestEvent) => Promise<unknown>>).default(event);

describe('the new-password page', () => {
	it('sends someone with no session to ask for a new link, since there is nothing to change a password for', async () => {
		const { event } = setup({ user: false });

		await expect((load as (e: RequestEvent) => Promise<unknown>)(event())).rejects.toMatchObject({
			status: 303,
			location: '/forgot-password?error=link'
		});
	});

	it('shows the form to someone the link signed in, and the confirmation after a change', async () => {
		const { event } = setup();

		expect(await (load as (e: RequestEvent) => Promise<unknown>)(event())).toMatchObject({
			done: false,
			form: expect.any(Object)
		});
		expect(
			await (load as (e: RequestEvent) => Promise<unknown>)(event({}, '?done=1'))
		).toMatchObject({
			done: true,
			form: expect.any(Object)
		});
	});

	it('changes the password and shows the confirmation', async () => {
		const { event, auth } = setup();

		await expect(
			submit(event({ password: 'a brand new password', passwordConfirm: 'a brand new password' }))
		).rejects.toMatchObject({
			status: 303,
			location: '/reset-password?done=1'
		});
		expect(auth.updateUser).toHaveBeenCalledWith({ password: 'a brand new password' });
	});

	it('refuses two different passwords or a bad one before Supabase is asked, handing nothing back', async () => {
		const { event, auth } = setup();

		const result = await submit(
			event({ password: 'a brand new password', passwordConfirm: 'a different one!' })
		);

		expect(result).toMatchObject({
			status: 400,
			data: { form: { errors: { passwordConfirm: expect.any(Array) } } }
		});
		expect(JSON.stringify(result)).not.toContain('brand new password');
		expect(auth.updateUser).not.toHaveBeenCalled();
	});

	it('answers a password Supabase finds weak or unchanged with a 400 the page can explain', async () => {
		for (const code of ['weak_password', 'same_password']) {
			const { event } = setup({
				updateUser: { data: {}, error: { code, status: 422, message: 'x' } }
			});

			expect(
				await submit(
					event({ password: 'a brand new password', passwordConfirm: 'a brand new password' })
				)
			).toMatchObject({
				status: 400,
				data: { form: { message: { code } } }
			});
		}
	});

	it('goes back to asking for a link when the session ran out in the meantime', async () => {
		const { event } = setup({
			updateUser: {
				data: {},
				error: { name: 'AuthSessionMissingError', status: 400, message: 'x' }
			}
		});

		await expect(
			submit(event({ password: 'a brand new password', passwordConfirm: 'a brand new password' }))
		).rejects.toMatchObject({
			location: '/forgot-password?error=link'
		});
	});

	it('does nothing for a post without a session', async () => {
		const { event, auth } = setup({ user: false });

		await expect(
			submit(event({ password: 'a brand new password', passwordConfirm: 'a brand new password' }))
		).rejects.toMatchObject({
			location: '/forgot-password?error=link'
		});
		expect(auth.updateUser).not.toHaveBeenCalled();
	});
});
