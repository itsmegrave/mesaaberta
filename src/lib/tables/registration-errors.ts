import { m } from '$lib/paraglide/messages';
import { formatWait } from './format';

/** What went wrong with a seat action, as a sentence. The code is the one the server put in the form message. */
export function registrationError(code: string, retryAfter?: number): string {
	switch (code) {
		case 'rate_limited':
			return m.error_rate_limited({ wait: formatWait(retryAfter ?? 60) });
		case 'table_full':
			return m.table_error_full();
		case 'already_registered':
			return m.table_error_already();
		case 'forbidden':
			return m.table_error_forbidden();
		case 'too_early':
			return m.table_error_too_early();
		case 'invalid':
			return m.table_error_invalid();
		default:
			return m.table_error_other();
	}
}
