<script lang="ts">
  // A checkbox and its text, the whole row a 44px target. Skeleton has no standalone checkbox: it
  // styles the native one (`.checkbox`), which keeps the keyboard and a native POST. The other
  // attributes (name, value, id, aria-*, onchange) go to the input.
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    checked = $bindable(false),
    align = 'center',
    class: className = '',
    children,
    ...attributes
  }: Omit<HTMLInputAttributes, 'type' | 'checked' | 'class' | 'children'> & {
    checked?: boolean;
    /** `start` for text that may wrap: the box stays by its first line. */
    align?: 'center' | 'start';
    /** Added to the row (the label). */
    class?: string;
    children: Snippet;
  } = $props();
</script>

<label class="flex min-h-11 gap-3 {align === 'start' ? 'items-start' : 'items-center'} {className}">
  <input
    type="checkbox"
    bind:checked
    {...attributes}
    class="checkbox shrink-0 {align === 'start' ? 'mt-1' : ''}"
  />
  {@render children()}
</label>
