import { fail } from '@sveltejs/kit';
import { flattenErrors, type FormResult } from './contract';
import type { FormMessage } from './message';

type Form<T> = { data: T; valid: boolean; errors: Record<string, unknown>; message?: FormMessage };

/** Never echo passwords, including when the request is refused. */
export function withoutSecrets<T extends Record<string, unknown>>(
  form: Form<T>,
  fields: (keyof T)[],
): Form<T> {
  for (const field of fields) (form.data as Record<keyof T, unknown>)[field] = '';
  return form;
}

export function formMessage<T extends Record<string, unknown>>(
  form: Form<T>,
  message: FormMessage,
  { status = 200 }: { status?: number } = {},
) {
  const result = responseForm(form);
  result.message = message;
  if (status >= 400) {
    result.valid = false;
    return fail(status, { form: result });
  }
  return { form: result };
}

export function refuse<T extends Record<string, unknown>>(
  form: Form<T>,
  status: number,
  code: string,
  field?: string,
) {
  form.valid = false;
  if (field && Object.hasOwn(form.data, field)) {
    form.errors = { ...form.errors, [field]: [code] };
    return fail(status, { form: responseForm(form) });
  }
  return formMessage(form, { code, field }, { status });
}

/** Form responses may contain text, booleans and arrays, never uploaded file bytes. */
export function responseForm<T extends Record<string, unknown>>(form: Form<T>): FormResult<T> {
  const data = { ...form.data };
  for (const field of Object.keys(data)) {
    if ((data as Record<string, unknown>)[field] instanceof File)
      delete (data as Record<string, unknown>)[field];
  }
  return {
    valid: form.valid,
    data,
    errors: flattenErrors(form.errors),
    ...(form.message ? { message: form.message } : {}),
  };
}
