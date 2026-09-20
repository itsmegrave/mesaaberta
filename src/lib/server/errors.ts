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

/** There is no seat left. Not a permission problem: the player may join if one frees up. */
export class TableFull extends Error {
	constructor(message = 'table full') {
		super(message);
		this.name = 'TableFull';
	}
}

/** The player already has a place at this table, confirmed or pending. */
export class AlreadyRegistered extends Error {
	constructor(message = 'already registered') {
		super(message);
		this.name = 'AlreadyRegistered';
	}
}

/** The input is well formed but cannot be accepted: it names a system that does not exist, say. */
export class Invalid extends Error {
	constructor(
		readonly field: string,
		message = 'invalid'
	) {
		super(message);
		this.name = 'Invalid';
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
	if (error instanceof TableFull) return fail(409, { error: 'table_full' as const });
	if (error instanceof AlreadyRegistered)
		return fail(409, { error: 'already_registered' as const });
	if (error instanceof Invalid) return fail(400, { error: 'invalid' as const, field: error.field });

	throw error;
}
