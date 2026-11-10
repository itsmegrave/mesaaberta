<script lang="ts" generics="V extends string">
  // One choice of a few, each a 44px pill with its radio: a tool's kind. The single-choice twin of
  // CheckboxPills. Native radios keep the arrow keys and a native POST, and Skeleton has no
  // standalone radio group. The picked pill takes the primary fill and a check; the pills wrap.
  import Icon from '#lib/components/ui/Icon.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';

  let {
    name,
    legend,
    hint,
    options,
    value = $bindable(),
    error,
  }: {
    name: string;
    legend: string;
    hint?: string;
    options: readonly { value: V; label: string }[];
    /** The picked option's value ('' while none is picked). */
    value: string;
    /** What is wrong with the choice; its id is `<name>-error`. */
    error?: string;
  } = $props();

  const describedBy = $derived(
    [hint ? `${name}-hint` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') ||
      undefined,
  );
</script>

<fieldset class="grid gap-2" aria-describedby={describedBy}>
  <legend class="mb-1 font-semibold">{legend}</legend>
  {#if hint}<p id="{name}-hint" class="text-sm text-muted">{hint}</p>{/if}
  <div class="flex flex-wrap gap-2">
    {#each options as option (option.value)}<label
        class="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-surface-200-800 bg-panel px-4 text-sm has-checked:border-primary-500 has-checked:preset-filled-primary-500 has-checked:font-semibold has-focus-visible:outline-4 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500"
        ><input
          type="radio"
          {name}
          value={option.value}
          bind:group={value}
          class="sr-only"
        />{#if value === option.value}<Icon name="check" size={16} />{/if}{option.label}</label
      >{/each}
  </div>
  <FieldError id={name} class="" message={error} />
</fieldset>
