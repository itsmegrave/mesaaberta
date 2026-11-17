<script lang="ts" generics="V extends string">
  // One choice of up to four short options, all in sight: a segmented row of pills on the wash, as
  // the boards draw it. Native radios keep the arrow keys and a native POST; the checked pill is
  // filled with the primary colour. A longer list is a SearchSelect.
  let {
    id,
    name,
    legend,
    legendClass = 'label-text font-semibold',
    class: rootClass = 'grid gap-2',
    options,
    value,
    size = 'md',
    invalid = false,
    disabled = false,
    describedby,
    onchange,
  }: {
    /** On the fieldset, so an error link can reach the choice. */
    id?: string;
    name: string;
    legend: string;
    legendClass?: string;
    class?: string;
    options: readonly { value: V; label: string }[];
    value: V;
    /** `sm` for a toolbar (36px); fields are 44px. */
    size?: 'sm' | 'md';
    invalid?: boolean;
    disabled?: boolean;
    describedby?: string;
    onchange?: (value: V) => void;
  } = $props();

  const pill = $derived(
    `btn rounded-full text-sm font-semibold has-checked:preset-filled-primary-500 has-focus-visible:outline-4 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500 has-disabled:cursor-not-allowed has-disabled:opacity-50 ${
      size === 'sm' ? 'h-7 px-3' : 'h-8 px-3'
    }`,
  );
</script>

<fieldset {id} class={rootClass} aria-describedby={describedby} {disabled}>
  <legend class={legendClass}>{legend}</legend>
  <div
    class="flex w-fit flex-wrap gap-1 rounded-3xl bg-surface-wash p-1 {invalid
      ? 'outline-2 outline-error-500'
      : ''}"
  >
    {#each options as option (option.value)}
      <label class={pill}>
        <input
          type="radio"
          {name}
          value={option.value}
          class="sr-only"
          checked={option.value === value}
          onchange={() => onchange?.(option.value)}
        />{option.label}
      </label>
    {/each}
  </div>
</fieldset>
