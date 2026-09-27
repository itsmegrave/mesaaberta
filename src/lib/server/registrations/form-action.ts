import { error, redirect } from '@sveltejs/kit';
import { message, superValidate, type ErrorStatus } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';
import type { AnyDb } from '../db/client';
import { requireUser } from '../auth/guard';
import type { Actor } from '../auth/policy';
import { safeNext } from '../auth/safe-next';
import { RateLimited, failFrom } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';

type Event = {
	locals: App.Locals;
	url: URL;
	request: Request;
	platform?: App.Platform;
	setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * What every join, leave, approve, decline and remove action shares: an anonymous visitor goes to
 * log in, and one without a username yet to finish the profile; the operation runs as the signed-in player; the events it wrote are dispatched after the
 * response; then the browser goes back to the page. A domain error (a full table, a refused
 * permission) becomes a form failure the page can show; anything else is a bug and surfaces.
 */
export async function runRegistrationAction<T extends Record<string, unknown>>(
	event: Event,
	schema: z.ZodType<T>,
	run: (db: AnyDb, actor: Actor | null, data: T) => Promise<{ eventIds: string[] }>
) {
	const { locals, url, request } = event;
	// The page itself, not the `?/join` action address, which only makes sense as a POST.
	await requireUser(locals, new URL(url.pathname, url));
	if (!locals.db) error(503, 'Database not configured');

	const form = await superValidate(request, zod4(schema));
	if (!form.valid) return message(form, { code: 'invalid' }, { status: 400 });

	try {
		const { eventIds } = await run(locals.db, await locals.getProfile(), form.data as T);
		for (const id of eventIds)
			locals.afterResponse((db) => dispatchEvent(db, handlersFor(event.platform?.env), id));
	} catch (e) {
		if (e instanceof RateLimited) {
			event.setHeaders?.({ 'Retry-After': String(e.retryAfterSeconds) });
		}
		const failure = failFrom(e);
		return message(
			form,
			{
				code: failure.data.error,
				field: 'field' in failure.data ? failure.data.field : undefined,
				retryAfter: 'retryAfter' in failure.data ? failure.data.retryAfter : undefined
			},
			{ status: failure.status as ErrorStatus }
		);
	}

	// Back to where the form was: the table page, or the dashboard when it names itself in `next`.
	redirect(303, safeNext(String((form.data as Record<string, unknown>).next ?? ''), url.pathname));
}
