import type { z } from 'zod';
import type { FormMessage } from '$lib/forms/message';
import { m } from '$lib/paraglide/messages';
import { formatWait } from './format';
import type { tableFormSchema } from './schema';
import { DEFAULT_WELCOME_MESSAGE } from './welcome';

/** What the form holds: the schema's values, with the numbers as numbers. */
export type TableFormValues = z.output<typeof tableFormSchema>;

export const NEW_TABLE_VALUES: TableFormValues = {
	systemSlug: '',
	title: '',
	description: '',
	extraInfo: '',
	welcomeMessage: DEFAULT_WELCOME_MESSAGE,
	kind: 'one_shot',
	capacity: 5,
	startsAtLocal: '',
	timezone: 'America/Sao_Paulo',
	durationMinutes: 240,
	repeat: 'weekly',
	until: '',
	joinMode: 'auto'
};

/** The sentence for a problem that is about the whole form, not one field; null when there is none. */
export function formProblem(message: FormMessage | undefined): string | null {
	if (!message || message.field) return null;
	if (message.code === 'forbidden') return m.form_error_forbidden();
	if (message.code === 'rate_limited') {
		return m.error_rate_limited({ wait: formatWait(message.retryAfter ?? 60) });
	}
	return m.form_error_unavailable();
}

/** A validation code (from `parseTableForm` or an `Invalid` error) as a sentence. */
export function errorText(code: string, field = ''): string {
	if (field === 'image' && code === 'too_big') return m.form_error_image_too_big();

	switch (code) {
		case 'required':
			return m.form_error_required();
		case 'too_small':
			return m.form_error_too_small();
		case 'too_big':
			return m.form_error_too_big();
		case 'before_start':
			return m.form_error_before_start();
		case 'in_the_past':
			return m.form_error_in_the_past();
		case 'not_an_image':
		case 'empty':
			return m.form_error_not_an_image();
		case 'upload_failed':
			return m.form_error_upload_failed();
		default:
			return m.form_error_invalid();
	}
}
