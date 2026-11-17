<script lang="ts" generics="V extends string">
  // One answer of a few, as a row of radios that wraps: the legend (with "(opcional)"), a hint,
  // then the options. Native radios keep the arrow keys and a native POST, and Skeleton has no
  // standalone radio group. For choices that need a card each, see RadioCards.
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    id,
    name,
    legend,
    hint,
    optional = false,
    options,
    value = $bindable(),
    error,
  }: {
    id: string;
    name: string;
    legend: string;
    hint?: string;
    /** Marks the question "(opcional)". */
    optional?: boolean;
    options: readonly { value: V; label: string }[];
    /** The picked option's value. */
    value: V;
    /** What is wrong with the answer; its id is `<id>-error`. */
    error?: string;
  } = $props();

  const describedBy = $derived(
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  );
</script>

<fieldset {id} aria-describedby={describedBy} class="min-w-0">
  <legend class="label-text font-semibold"
    >{legend}{#if optional}<span class="font-normal text-muted">&nbsp;({m.form_optional()})</span
      >{/if}</legend
  >
  {#if hint}<p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>{/if}
  <div class="mt-1 flex flex-wrap gap-x-6">
    {#each options as option (option.value)}
      <label class="flex min-h-11 cursor-pointer items-center gap-3"
        ><input
          type="radio"
          class="radio"
          {name}
          value={option.value}
          bind:group={value}
        />{option.label}</label
      >
    {/each}
  </div>
  <FieldError {id} message={error} />
</fieldset>
