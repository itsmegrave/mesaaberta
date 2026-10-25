<script lang="ts">
  // A select of a list's toolbar ("Instagram", "Tipo"): the shared search select, applying at once
  // and keeping the other filters. The option the list opens on has no parameter.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import { listPath, listQuery } from '@mesaaberta/core/admin/list';

  let {
    id,
    name,
    label,
    options,
    value,
    fallback = options[0]?.slug,
    hash = '',
    class: className = 'w-56',
    inDialog = false,
  }: {
    id: string;
    /** The query parameter. */
    name: string;
    label: string;
    options: { name: string; slug: string }[];
    value: string;
    fallback?: string;
    hash?: string;
    class?: string;
    inDialog?: boolean;
  } = $props();

  const pick = (picked: string[]) => {
    const next = picked[0] ?? fallback;
    // The list also reports the pick it already has; only a new one reloads.
    if (next === value) return;
    void goto(
      listPath(
        page.url.pathname,
        listQuery(page.url.searchParams, { [name]: next === fallback ? null : next }),
        hash,
      ),
      { reset: false },
    );
  };
</script>

<div class={className}>
  <SearchSelect
    {id}
    {name}
    {label}
    labelClass="sr-only"
    class="grid"
    compact
    {inDialog}
    items={options}
    value={[value]}
    placeholder={label}
    onchange={pick}
  />
</div>
