import type { z, ZodType } from 'zod';

export type FormErrors = Record<string, string[]>;
export type FormResult<T> = { valid: boolean; data: T; errors: FormErrors };

export function issueErrors(issues: readonly z.core.$ZodIssue[]): FormErrors {
  const errors: FormErrors = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.') || '_errors';
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}

/** Scalar string actions only. Arrays, numbers and files need explicit domain decoders. */
export function validateStringForm<T extends ZodType>(
  data: FormData,
  schema: T,
  fields: readonly string[],
): FormResult<z.output<T>> {
  const values: Record<string, string> = {};
  const errors: FormErrors = {};
  for (const field of fields) {
    const entries = data.getAll(field);
    if (entries.length > 1 || entries.some((entry) => typeof entry !== 'string')) {
      errors[field] = ['invalid'];
      continue;
    }
    if (typeof entries[0] === 'string') values[field] = entries[0];
  }
  const parsed = schema.safeParse(values);
  return {
    valid: parsed.success && Object.keys(errors).length === 0,
    // Only the allowlisted text fields can be echoed, never arbitrary files or passwords.
    data: (parsed.success ? parsed.data : values) as z.output<T>,
    errors: { ...(parsed.success ? {} : issueErrors(parsed.error.issues)), ...errors },
  };
}
