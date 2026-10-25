<script lang="ts">
  // A single-choice filter with few options, as a segmented control with the count of each ("Ativa 4").
  // Native radios keep arrow-key behaviour; picking one applies at once and keeps the other filters.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { listPath, listQuery } from '@mesaaberta/core/admin/list';

  type Option = { value: string; label: string; count?: number };

  let {
    name,
    label,
    options,
    value,
    fallback = options[0]?.value,
    hash = '',
    class: className = '',
  }: {
    /** The query parameter. */
    name: string;
    /** The group's accessible name ("Status"). */
    label: string;
    options: Option[];
    value: string;
    /** The option the list opens on: it has no parameter, so its address stays short. */
    fallback?: string;
    hash?: string;
    class?: string;
  } = $props();

  const pick = (next: string) =>
    goto(
      listPath(
        page.url.pathname,
        listQuery(page.url.searchParams, { [name]: next === fallback ? null : next }),
        hash,
      ),
      { reset: false },
    );
  // The radio name must not clash with another group on the page, nor with the same filter drawn
  // for the other screen size.
  const uid = $props.id();
  const group = $derived(`filter-${name}-${uid}`);
</script>

<div
  role="radiogroup"
  aria-label={label}
  class="grid grid-cols-2 gap-1 rounded-lg border border-surface-200-800 bg-surface-wash p-1 md:inline-flex md:flex-wrap {className}"
>
  {#each options as option (option.value)}
    <label
      class="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1 text-center text-sm leading-tight font-semibold hover:bg-surface-wash has-checked:bg-panel has-checked:shadow-sm has-focus-visible:outline-4 has-focus-visible:outline-primary-500 md:whitespace-nowrap"
    >
      <input
        type="radio"
        class="sr-only"
        name={group}
        value={option.value}
        checked={option.value === value}
        onchange={() => pick(option.value)}
      />
      {option.label}
      {#if option.count !== undefined}
        <span class="text-xs font-semibold text-muted tabular-nums">{option.count}</span>
      {/if}
    </label>
  {/each}
</div>
