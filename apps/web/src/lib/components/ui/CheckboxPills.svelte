<script lang="ts" generics="V extends string">
  // Some choices of a few, each a 44px pill with its checkbox: a partner's kinds. Native checkboxes
  // keep the keyboard and a native POST (one `name` value per pick), and Skeleton has no standalone
  // checkbox group. A picked pill takes the primary fill and a check. The pills wrap; they never
  // scroll sideways. Nothing is disabled at the limit: the error says what is wrong instead.
  import Icon from '#lib/components/ui/Icon.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';

  let {
    name,
    legend,
    hint,
    options,
    group = $bindable([]),
    error,
  }: {
    name: string;
    legend: string;
    hint?: string;
    options: readonly { value: V; label: string }[];
    group: V[];
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
        class="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-surface-200-800 bg-panel px-3 text-sm has-checked:border-primary-500 has-checked:preset-filled-primary-500 has-checked:font-semibold has-focus-visible:outline-4 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500"
        ><input
          type="checkbox"
          {name}
          value={option.value}
          bind:group
          class="sr-only"
        />{#if group.includes(option.value)}<Icon
            name="check"
            size={16}
          />{/if}{option.label}</label
      >{/each}
  </div>
  <FieldError id={name} class="" message={error} />
</fieldset>
