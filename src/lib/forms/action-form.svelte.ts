import { applyAction } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { createForm, type DeepKeys, type DeepValue } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import type { FormMessage } from './message';
import type { ActionResult } from '@sveltejs/kit';
import type { ZodType } from 'zod';
import { tick } from 'svelte';
import { toStore } from 'svelte/store';
import { queryClient } from '$lib/query/context';
import { afterWrite } from '$lib/query/invalidate';
import { postAction } from './action';
import { issueErrors, type FormErrors, type FormResult } from './contract';

/** A single submit path, with native POST when JavaScript is unavailable. */
export function actionForm<T extends Record<string, unknown>>(options: {
  initial: T;
  initialErrors?: FormErrors;
  initialMessage?: FormMessage;
  schema: ZodType;
  /** Omit for route-only data, such as the notification feed and bell. */
  domain?: Parameters<typeof afterWrite>[1];
  onSuccess: () => void;
  onSending?: (data: FormData) => void;
  onError?: () => void;
  refresh?: boolean;
  onFailure?: (form: FormResult<T> | undefined) => void;
  /** Return true when the component owns result handling (for example chat). */
  onResult?: (result: ActionResult) => boolean | void | Promise<boolean | void>;
  errorMessage: () => string;
}) {
  const client = queryClient();
  let errors = $state<FormErrors>(options.initialErrors ?? {});
  let message = $state<FormMessage | undefined>(options.initialMessage);
  let pending = $state(false);
  let delayed = $state(false);
  let timeout = $state(false);
  let sentValues: T | undefined;
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
      options.onSending?.(submission!.data);
      const result = await mutation.mutateAsync(submission!);
      const payload =
        result.type === 'success' || result.type === 'failure'
          ? (result.data as { form?: FormResult<T> } | undefined)
          : undefined;
      message = payload?.form?.message;
      const handled = await options.onResult?.(result);
      if (handled) return;
      if (result.type === 'failure') {
        errors = payload?.form?.errors ?? { _errors: [options.errorMessage()] };
        options.onFailure?.(payload?.form);
        return;
      }
      if (result.type === 'success') {
        options.onSuccess();
        // The write is already confirmed. A read refresh must never cause a write retry.
        await Promise.allSettled([
          ...(options.domain ? [afterWrite(client, options.domain)] : []),
          ...(options.refresh === false ? [] : [invalidateAll()]),
        ]);
        return;
      }
      if (result.type === 'redirect') {
        options.onSuccess();
        if (options.domain) await Promise.allSettled([afterWrite(client, options.domain)]);
      }
      await applyAction(result);
    },
  }));
  const values = form.useSelector((state) => state.values);
  const dirty = form.useSelector((state) => state.isDirty);
  // A cloned writable Svelte binding for compound fields; TanStack remains the source of truth.
  // Never mutate TanStack's snapshot in place through a nested bind:value/group.
  const draft = toStore(
    () => structuredClone($state.snapshot(values.current)),
    (next) => {
      next = $state.snapshot(next);
      for (const field of Object.keys(next)) {
        form.setFieldValue(field as DeepKeys<T>, next[field] as DeepValue<T, DeepKeys<T>>);
      }
    },
  );
  return {
    draft,
    get dirty() {
      return dirty.current;
    },
    get values() {
      return values.current;
    },
    get message() {
      return message;
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
    markSaved() {
      // Edits made while the request was in flight remain unsaved.
      if (
        sentValues &&
        JSON.stringify($state.snapshot(values.current)) === JSON.stringify(sentValues)
      ) {
        form.reset(sentValues);
        errors = {};
        message = undefined;
      }
    },
    reset(next?: T, { preserveErrors = false } = {}) {
      form.reset(next);
      if (!preserveErrors) {
        errors = {};
        message = undefined;
      }
    },
    change<K extends DeepKeys<T>>(field: K, value: DeepValue<T, K>) {
      form.setFieldValue(field, value);
      errors = Object.fromEntries(Object.entries(errors).filter(([path]) => path !== field));
    },
    async submit(event: SubmitEvent) {
      event.preventDefault();
      if (pending) return;
      const element = event.currentTarget as HTMLFormElement;
      sentValues = structuredClone($state.snapshot(values.current));
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
        options.onError?.();
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
