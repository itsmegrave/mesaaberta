<script lang="ts">
  // A form that is one button: it posts `fields` as hidden inputs to `action` (natively without
  // JavaScript, through actionForm with it), shows the button busy while it posts, and under it the
  // line `error` makes of the errors. The caller keeps its schema and its error words.
  import { untrack, type Snippet } from 'svelte';
  import type { ActionResult } from '$app/forms';
  import type { ZodType } from 'zod';
  import MAButton, {
    type ButtonSize,
    type ButtonVariant,
  } from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import type { FormErrors, FormResult } from '#lib/forms/contract.js';
  import type { afterWrite } from '#lib/query/invalidate.js';
  import { toast } from '#lib/toaster.js';

  type Fields = Record<string, string | boolean | undefined>;

  let {
    action,
    fields = {},
    schema,
    domain,
    refresh,
    errorMessage,
    success,
    onSuccess,
    onResult,
    onFailure,
    error,
    errorClass = 'mt-1',
    class: className = '',
    variant = 'ghost',
    size = 'custom',
    buttonClass = '',
    children,
    content,
    after,
  }: {
    action: string;
    /**
     * The values the action takes. An empty or missing one is not posted. A value that changes is
     * posted from then on (ChatHeader's switch).
     */
    fields?: Fields;
    schema: ZodType;
    /** The cache domain the write touches; none for route-only data. */
    domain?: Parameters<typeof afterWrite>[1];
    /** False when the page should not reload its data afterwards. */
    refresh?: boolean;
    errorMessage: () => string;
    /** Shown as a toast when the action went through. */
    success?: string;
    /** Runs when the action went through, with the values it posted. */
    onSuccess?: (values: Fields) => void;
    onResult?: (result: ActionResult) => boolean | void | Promise<boolean | void>;
    onFailure?: (form: FormResult<Fields> | undefined) => void;
    /** The line under the button for these errors; none shows nothing. */
    error?: (errors: FormErrors) => string | undefined;
    errorClass?: string;
    /** The form's classes. */
    class?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    buttonClass?: string;
    /** The button's content. */
    children?: Snippet;
    /** The form's content instead of the button (a button of its own must be `type="submit"`). */
    content?: Snippet;
    /** After the button: a hint beside it. */
    after?: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  const form = actionForm<Fields>({
    initial: { ...fields },
    schema,
    domain,
    refresh,
    errorMessage,
    onResult,
    onFailure,
    onSuccess() {
      if (success) toast.success(success);
      onSuccess?.(form.values);
    },
  });

  // A field the caller changes is posted from then on. `change` also reads and rewrites the form's
  // errors, so it runs untracked: only `fields` should rerun this.
  let seen = untrack(() => ({ ...fields }));
  $effect(() => {
    const current = { ...fields };
    untrack(() => {
      for (const [name, value] of Object.entries(current))
        if (!Object.is(seen[name], value)) form.change(name, value);
      seen = current;
    });
  });

  const message = $derived(error?.(form.errors));
</script>

<MAForm {action} onsubmit={form.submit} class={className || undefined}>
  {#each Object.entries(fields) as [name, value] (name)}
    {#if value !== undefined && value !== ''}
      <input type="hidden" {name} value={String(form.values[name])} />
    {/if}
  {/each}
  {#if content}
    {@render content()}
  {:else}
    <MAButton
      type="submit"
      {variant}
      {size}
      controller={form}
      class="{size === 'custom' ? 'gap-2' : ''} {buttonClass}">{@render children?.()}</MAButton
    >
  {/if}
  {@render after?.()}
  {#if message}
    <p role="alert" class="{errorClass} text-sm font-semibold text-error-700-300">{message}</p>
  {/if}
</MAForm>
