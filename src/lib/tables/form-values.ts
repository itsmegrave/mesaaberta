import { m } from '$lib/paraglide/messages';
import { DEFAULT_WELCOME_MESSAGE } from './welcome';

/** What the form holds while it is being filled in: every value is the text of an input. */
export type FormValues = {
	systemSlug: string;
	title: string;
	description: string;
	extraInfo: string;
	welcomeMessage: string;
	kind: string;
	capacity: string;
	startsAtLocal: string;
	timezone: string;
	durationMinutes: string;
	repeat: string;
	until: string;
	joinMode: string;
};

export const NEW_TABLE_VALUES: FormValues = {
	systemSlug: '',
	title: '',
	description: '',
	extraInfo: '',
	// The token stays literal: the title is not known yet, and it is expanded when the message is sent.
	welcomeMessage: DEFAULT_WELCOME_MESSAGE,
	kind: 'one_shot',
	capacity: '5',
	startsAtLocal: '',
	timezone: 'America/Sao_Paulo',
	durationMinutes: '240',
	repeat: 'weekly',
	until: '',
	joinMode: 'auto'
};

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
