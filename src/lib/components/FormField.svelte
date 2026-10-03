<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages';

  /**
   * A field's frame: the label, "(opcional)" when it may be left empty, and a counter ("23 / 80") on
   * the first line; the hint above the control; the control; the error below. The control can take
   * `aria-describedby` and `aria-invalid` from the snippet's argument, so the hint and the error
   * are read with it.
   */
  let {
    id,
    label,
    hint,
    error,
    optional = false,
    counter,
    children,
  }: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    /** Marks the field "(opcional)". */
    optional?: boolean;
    /** What is typed against what is allowed; goes red past the limit. */
    counter?: { count: number; max: number };
    children: Snippet<[{ 'aria-describedby'?: string; 'aria-invalid'?: 'true' }]>;
  } = $props();

  const control = $derived({
    'aria-describedby':
      [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? ('true' as const) : undefined,
  });
</script>

<div class="min-w-0">
  <div class="flex items-baseline justify-between gap-3">
    <label for={id} id="{id}-label" class="label-text block font-semibold"
      >{label}{#if optional}<span class="font-normal text-muted">&nbsp;({m.form_optional()})</span
        >{/if}</label
    >
    {#if counter}
      <span
        aria-hidden="true"
        class="shrink-0 text-sm tabular-nums {counter.count > counter.max
          ? 'font-semibold text-error-700-300'
          : 'text-muted'}">{counter.count} / {counter.max}</span
      >
    {/if}
  </div>
  {#if hint}<p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>{/if}
  <div class="mt-1">{@render children(control)}</div>
  {#if error}<p id="{id}-error" role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
      {error}
    </p>{/if}
</div>
