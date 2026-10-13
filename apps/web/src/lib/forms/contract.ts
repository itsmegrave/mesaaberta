import type { z, ZodType } from 'zod';
import type { FormMessage } from './message';

export type FormErrors = Record<string, string[]>;
export type FormResult<T> = { valid: boolean; data: T; errors: FormErrors; message?: FormMessage };

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

export function initialForm<T>(data: T): FormResult<T> {
  return { valid: false, data, errors: {} };
}

/** Explicit decoders for native POST values, including repeated arrays and unchecked booleans. */
export function validateFormData<S extends ZodType>(
  data: FormData,
  schema: S,
  defaults: Partial<z.output<S>>,
  options: {
    arrays?: readonly string[];
    booleans?: readonly string[];
    files?: readonly string[];
  } = {},
): FormResult<z.output<S>> {
  const values: Record<string, unknown> = { ...defaults };
  const invalid: FormErrors = {};
  for (const key of Object.keys(defaults)) {
    const entries = data.getAll(key);
    if (options.arrays?.includes(key)) {
      if (entries.some((value) => typeof value !== 'string')) invalid[key] = ['invalid'];
      else values[key] = entries;
    } else if (options.booleans?.includes(key)) {
      if (
        entries.length > 1 ||
        entries.some((value) => !['true', 'false', 'on', ''].includes(String(value)))
      )
        invalid[key] = ['invalid'];
      values[key] = entries.length > 0 && entries[0] !== 'false' && entries[0] !== '';
    } else if (
      entries.length > 1 ||
      (entries.length && typeof entries[0] !== 'string' && !options.files?.includes(key))
    ) {
      invalid[key] = ['invalid'];
    } else if (entries.length) {
      const entry = entries[0];
      // Undici can decode an empty filename as an empty string instead of a File.
      values[key] =
        options.files?.includes(key) &&
        (entry === '' || (entry instanceof File && entry.size === 0))
          ? undefined
          : entry;
    }
  }
  const result = schema.safeParse(values);
  return {
    valid: result.success && !Object.keys(invalid).length,
    data: (result.success ? result.data : values) as z.output<S>,
    errors: { ...(result.success ? {} : issueErrors(result.error.issues)), ...invalid },
  };
}

/** Normalize server field errors, including nested array paths. */
export function flattenErrors(errors: Record<string, unknown>, prefix = ''): FormErrors {
  const result: FormErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    const path = key === '_errors' && prefix ? prefix : prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
      result[path] = value;
    else if (value && typeof value === 'object')
      Object.assign(result, flattenErrors(value as Record<string, unknown>, path));
  }
  return result;
}
