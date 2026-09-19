import { fail } from '@sveltejs/kit';

// Domain errors: what code below the route throws when a request cannot be honoured. The message
// is for logs and never reaches the browser; `failFrom` decides what the visitor sees.

export class Forbidden extends Error {
	constructor(message = 'forbidden') {
		super(message);
		this.name = 'Forbidden';
	}
}

export class NotFound extends Error {
	constructor(message = 'not found') {
		super(message);
		this.name = 'NotFound';
	}
}

/**
 * The one place a domain error becomes a form failure. Use it in a form action's `catch`:
 * `catch (error) { return failFrom(error); }`. Anything that is not a domain error is a bug, so it
 * is rethrown and becomes a 500 rather than a misleading 403.
 */
export function failFrom(error: unknown) {
	if (error instanceof Forbidden) return fail(403, { error: 'forbidden' as const });
	if (error instanceof NotFound) return fail(404, { error: 'not_found' as const });

	throw error;
}
