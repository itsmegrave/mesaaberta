<script lang="ts" generics="V extends string">
  // One choice of a few, each a card with its radio. Native radios keep the arrow keys and a native
  // POST, and Skeleton has no standalone radio group. The checked card takes the primary border.
  import Icon from '#lib/components/Icon.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import type { IconName } from '#lib/icons/names.js';

  let {
    name,
    legend,
    options,
    group = $bindable(),
    error,
  }: {
    name: string;
    legend: string;
    options: readonly { value: V; label: string; icon?: IconName }[];
    group: V;
    /** What is wrong with the choice; its id is `<name>-error`. */
    error?: string;
  } = $props();
</script>

<fieldset class="grid gap-3 sm:grid-cols-2">
  <legend class="mb-2 font-semibold sm:col-span-2">{legend}</legend>
  {#each options as option (option.value)}<label
      class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10"
      ><input type="radio" {name} value={option.value} bind:group />{#if option.icon}<Icon
          name={option.icon}
          size={20}
        />{/if}{option.label}</label
    >{/each}
  <FieldError id={name} class="" message={error} />
</fieldset>
