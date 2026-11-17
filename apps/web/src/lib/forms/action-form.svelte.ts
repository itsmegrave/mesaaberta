import { applyAction, type ActionResult } from '$app/forms';
import { refreshAll } from '$app/navigation';
import { createForm, type DeepKeys, type DeepValue } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import type { FormMessage } from './message';
import type { ZodType } from 'zod';
import { tick, untrack } from 'svelte';
import { toStore } from 'svelte/store';
import { queryClient } from '#lib/query/context.js';
import { afterWrite } from '#lib/query/invalidate.js';
import { postAction } from './action';
import { inFlight } from './in-flight.svelte';
import { issueErrors, type FormErrors, type FormResult } from './contract';

/** A single submit path, with native POST when JavaScript is unavailable. */
/** Whether a redirect leads back to the page the form is on (same path and query). */
function samePage(location: string) {
  const here = new URL(window.location.href);
  const target = new URL(location, here);
  return (
    target.origin === here.origin &&
    target.pathname === here.pathname &&
    target.search === here.search
  );
}

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
  /** True when the page already shows the write as it goes (a chat message): no top bar for it. */
  quiet?: boolean;
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
  const initialValues = structuredClone($state.snapshot(options.initial)) as T;
  const form = createForm(() => ({
    defaultValues: initialValues,
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
          ...(options.refresh === false ? [] : [refreshAll()]),
        ]);
        return;
      }
      if (result.type === 'redirect') {
        options.onSuccess();
        if (options.domain) await Promise.allSettled([afterWrite(client, options.domain)]);
        // Back to this same page (a form's `next`): refresh it in place, so the person keeps their
        // scroll position and focus instead of landing at the top of a fresh navigation.
        if (samePage(result.location)) {
          if (options.refresh !== false) await Promise.allSettled([refreshAll()]);
          return;
        }
      }
      await applyAction(result);
    },
  }));
  const values = form.useSelector((state) => state.values);
  const dirty = form.useSelector((state) => state.isDirty);
  const currentValues = (): T => {
    // Track the selector, but read the store synchronously: hydration can restore an
    // input before the selector subscribes, and must not overwrite that first edit.
    void values.current;
    return form.state.values;
  };
  // A cloned writable Svelte binding for compound fields; TanStack remains the source of truth.
  // Never mutate TanStack's snapshot in place through a nested bind:value/group.
  // Form values are plain fields, arrays and Files; removing proxies preserves that contract.
  const snapshot = (value: T): T => structuredClone($state.snapshot(value)) as T;
  const draft = toStore(
    () => snapshot(currentValues()),
    (next: T) => {
      next = snapshot(next);
      for (const field of Object.keys(next)) {
        // Component bindings can echo their current scalar value during mount.
        if (Object.is(next[field], currentValues()[field])) continue;
        form.setFieldValue(field as DeepKeys<T>, next[field] as DeepValue<T, DeepKeys<T>>);
      }
    },
  );
  function validateField(field: DeepKeys<T>) {
    const parsed = options.schema.safeParse(currentValues());
    const fieldErrors = parsed.success ? {} : issueErrors(parsed.error.issues);
    errors = {
      ...Object.fromEntries(Object.entries(errors).filter(([path]) => path !== field)),
      ...(fieldErrors[field] ? { [field]: fieldErrors[field] } : {}),
    };
  }
  return {
    draft,
    get dirty() {
      void dirty.current;
      return form.state.isDirty;
    },
    get values() {
      return currentValues();
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
        JSON.stringify($state.snapshot(currentValues())) === JSON.stringify(sentValues)
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
      // Untracked, so an `$effect` that calls `change` does not depend on the form state it writes
      // (it would run itself again forever: effect_update_depth_exceeded).
      untrack(() => {
        form.setFieldValue(field, value);
        if (field in errors)
          errors = Object.fromEntries(Object.entries(errors).filter(([path]) => path !== field));
      });
    },
    validateField,
    /**
     * `onfocusout` of the form: checks the field that was just left, so an error shows once someone
     * has been in the field and out of it (and on a submit attempt), never while they are typing.
     */
    blur(event: FocusEvent) {
      const field = (event.target as { name?: unknown } | null)?.name;
      if (typeof field !== 'string' || !(field in currentValues())) return;
      validateField(field as DeepKeys<T>);
    },
    async submit(event: SubmitEvent) {
      event.preventDefault();
      if (pending) return;
      const element = event.currentTarget as HTMLFormElement;
      sentValues = snapshot(currentValues());
      submission = { action: element.action, data: new FormData(element, event.submitter) };
      pending = true;
      const finish = options.quiet ? () => {} : inFlight.start();
      // The spinner joins the label after 300 ms; the button is dimmed and busy before that.
      const slow = setTimeout(() => {
        delayed = true;
      }, 300);
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
        finish();
        pending = delayed = timeout = false;
        submission = undefined;
        await tick();
        if (Object.keys(errors).length)
          element.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }
    },
  };
}
