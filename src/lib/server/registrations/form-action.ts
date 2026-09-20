import { error, redirect } from '@sveltejs/kit';
import type { AnyDb } from '../db/client';
import type { Actor } from '../auth/policy';
import { safeNext } from '../auth/safe-next';
import { failFrom } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';

type Event = { locals: App.Locals; url: URL; request: Request; platform?: App.Platform };

/**
 * What every join, leave, approve, decline and remove action shares: an anonymous visitor goes to
 * log in; the operation runs as the signed-in player; the events it wrote are dispatched after the
 * response; then the browser goes back to the page. A domain error (a full table, a refused
 * permission) becomes a form failure the page can show; anything else is a bug and surfaces.
 */
export async function runRegistrationAction(
	event: Event,
	run: (db: AnyDb, actor: Actor | null, form: FormData) => Promise<{ eventIds: string[] }>
) {
	const { locals, url, request } = event;
	if (!(await locals.getUser())) {
		// The page itself, not the `?/join` action address, which only makes sense as a POST.
		redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	}
	if (!locals.db) error(503, 'Database not configured');

	const form = await request.formData();

	try {
		const { eventIds } = await run(locals.db, await locals.getProfile(), form);
		for (const id of eventIds)
			locals.afterResponse((db) => dispatchEvent(db, handlersFor(event.platform?.env), id));
	} catch (e) {
		return failFrom(e);
	}

	// Back to where the form was: the table page, or the dashboard when it names itself in `next`.
	redirect(303, safeNext(String(form.get('next') ?? ''), url.pathname));
}
