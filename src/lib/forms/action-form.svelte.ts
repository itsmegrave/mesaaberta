import { applyAction } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { createForm, type DeepKeys, type DeepValue } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import type { ZodType } from 'zod';
import { tick } from 'svelte';
import { queryClient } from '$lib/query/context';
import { afterWrite } from '$lib/query/invalidate';
import { postAction } from './action';
import { issueErrors, type FormErrors, type FormResult } from './contract';

/** A single submit path, with native POST when JavaScript is unavailable. */
export function actionForm<T extends Record<string, string>>(options: {
  initial: T;
  schema: ZodType;
  /** Omit for route-only data, such as the notification feed and bell. */
  domain?: Parameters<typeof afterWrite>[1];
  onSuccess: () => void;
  errorMessage: () => string;
}) {
  const client = queryClient();
  let errors = $state<FormErrors>({});
  let pending = $state(false);
  let delayed = $state(false);
  let timeout = $state(false);
  let submission: { action: string; data: FormData } | undefined;
  const mutation = createMutation(
    () => ({
      mutationFn: ({ action, data }: { action: string; data: FormData }) =>
        postAction(action, data),
      retry: false,
    }),
    () => client,
  );
  const form = createForm(() => ({
    defaultValues: options.initial,
    validators: {
      onSubmit: ({ value }) => {
        const parsed = options.schema.safeParse(value);
        errors = parsed.success ? {} : issueErrors(parsed.error.issues);
        return parsed.success ? undefined : 'invalid';
      },
    },
    onSubmit: async () => {
      const result = await mutation.mutateAsync(submission!);
      if (result.type === 'failure') {
        const payload = result.data as { form?: FormResult<T> } | undefined;
        errors = payload?.form?.errors ?? { _errors: [options.errorMessage()] };
        return;
      }
      if (result.type === 'success') {
        options.onSuccess();
        // The write is already confirmed. A read refresh must never cause a write retry.
        await Promise.allSettled([
          ...(options.domain ? [afterWrite(client, options.domain)] : []),
          invalidateAll(),
        ]);
        return;
      }
      await applyAction(result);
    },
  }));
  const values = form.useSelector((state) => state.values);
  return {
    get values() {
      return values.current;
    },
    get errors() {
      return errors;
    },
    get pending() {
      return pending;
    },
    get delayed() {
      return delayed;
    },
    get timeout() {
      return timeout;
    },
    reset() {
      form.reset();
      errors = {};
    },
    change<K extends DeepKeys<T>>(field: K, value: DeepValue<T, K>) {
      form.setFieldValue(field, value);
      errors = Object.fromEntries(Object.entries(errors).filter(([path]) => path !== field));
    },
    async submit(event: SubmitEvent) {
      event.preventDefault();
      if (pending) return;
      const element = event.currentTarget as HTMLFormElement;
      submission = { action: element.action, data: new FormData(element, event.submitter) };
      pending = true;
      const slow = setTimeout(() => {
        delayed = true;
      }, 500);
      const verySlow = setTimeout(() => {
        timeout = true;
      }, 8_000);
      try {
        await form.handleSubmit();
      } catch {
        errors = { _errors: [options.errorMessage()] };
      } finally {
        clearTimeout(slow);
        clearTimeout(verySlow);
        pending = delayed = timeout = false;
        submission = undefined;
        await tick();
        if (Object.keys(errors).length)
          element.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }
    },
  };
}
