import type { FormErrors } from './contract';
import type { FormMessage } from './message';

/** An invalid field as ErrorSummary lists it: the id of its control, its label, what is wrong. */
export type Problem = { id: string; label: string; message: string };

type ErrorSource = { readonly errors: FormErrors; readonly message?: FormMessage };

/** A field of the summary: its name, its label and, when the control's id is not the name, the id. */
export type SummaryEntry<F extends string> = readonly [field: F, label: string, id?: string];

// A plain field's errors are a list; a list field's (platforms, tags) may come as `{ _errors }`.
function firstCode(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0] as string | undefined;
  return (value as { _errors?: string[] } | undefined)?._errors?.[0] ?? undefined;
}

/**
 * A form's field errors as sentences. It reads the controller's errors and message each time it is
 * called, so the template and `$derived` keep up with them.
 */
export function fieldErrors<F extends string>(
  /** The controller, or a getter for it when it is a prop (so the latest one is read). */
  from: ErrorSource | (() => ErrorSource),
  /** The sentence for a validation code. */
  text: (code: string, field: F) => string | undefined,
) {
  const read = typeof from === 'function' ? from : () => from;
  const err = (field: F): string | undefined => {
    const code = firstCode(read().errors[field]);
    return code ? text(code, field) : undefined;
  };
  return {
    /** What is wrong with a field; undefined when nothing is. */
    err,
    /** `aria-invalid` for a control that draws its own label (it cannot sit in FormField). */
    invalid: (field: F): 'true' | undefined =>
      firstCode(read().errors[field]) ? 'true' : undefined,
    /**
     * A field's error, or the form message's when the message names the field (an image the schema
     * accepted but the upload refused).
     */
    withMessage(
      field: F,
      messageText: (code: string) => string | undefined = (code) => text(code, field),
    ) {
      const message = read().message;
      return err(field) ?? (message?.field === field ? messageText(message.code) : undefined);
    },
    /**
     * Each invalid field, in the order given (the order the form asks for them), then the extra
     * problems that have a message, for the summary at the top.
     */
    summary(entries: readonly SummaryEntry<F>[], ...extra: (Problem | undefined)[]): Problem[] {
      return [
        ...entries.flatMap(([field, label, id = field]) => {
          const message = err(field);
          return message ? [{ id, label, message }] : [];
        }),
        ...extra.filter((problem): problem is Problem => !!problem?.message),
      ];
    },
  };
}

/** A problem for the summary, or undefined when there is no message. */
export function problem(
  id: string,
  label: string,
  message: string | undefined,
): Problem | undefined {
  return message ? { id, label, message } : undefined;
}
