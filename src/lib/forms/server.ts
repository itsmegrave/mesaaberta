import { message, setError, type ErrorStatus, type SuperValidated } from 'sveltekit-superforms';
import type { FormMessage } from './message';

type Form<T extends Record<string, unknown>> = SuperValidated<T, FormMessage>;

/** Never send a secret back to the browser: not even when the form is refused. */
export function withoutSecrets<T extends Record<string, unknown>>(
	form: Form<T>,
	fields: (keyof T)[]
): Form<T> {
	for (const field of fields) (form.data as Record<keyof T, unknown>)[field] = '';
	return form;
}

/**
 * Refuses a submit for a reason that is not a schema rule: the code lands on the field it names
 * (so the form shows it there), or in the form message when the field is not one the schema knows.
 */
export function refuse<T extends Record<string, unknown>>(
	form: Form<T>,
	status: ErrorStatus,
	code: string,
	field?: string
) {
	if (field && Object.hasOwn(form.data, field))
		return setError(form, field as never, code, { status });
	return message(form, { code, field }, { status });
}
