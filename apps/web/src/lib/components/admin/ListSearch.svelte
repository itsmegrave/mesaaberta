<script lang="ts">
  // The search box of an admin list: an icon inside, 44px tall. It applies on its own a moment after
  // the typing stops (and at once on Enter), keeping the other filters. Without JavaScript the form
  // is a plain GET that carries them along as hidden fields.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { listPath, listQuery } from '@mesaaberta/core/admin/list';

  let {
    value,
    label,
    placeholder = label,
    maxlength = 100,
    hash = '',
    class: className = '',
  }: {
    /** What the address already searches for. */
    value: string;
    /** The accessible name, which says what is searched ("Buscar mesa, sistema ou @usuário de quem mestra"). */
    label: string;
    placeholder?: string;
    maxlength?: number;
    /** Keeps the place on the page after a search. */
    hash?: string;
    class?: string;
  } = $props();

  // What is typed; it follows the address when that changes (back, a cleared filter).
  let text = $derived(value);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const apply = (next: string) => {
    clearTimeout(timer);
    const typed = next.trim();
    if (typed === value) return;
    void goto(
      listPath(page.url.pathname, listQuery(page.url.searchParams, { q: typed || null }), hash),
      { reset: false },
    );
  };
  const kept = $derived(
    [...page.url.searchParams].filter(([key]) => key !== 'q' && key !== 'page'),
  );
</script>

<form
  method="GET"
  role="search"
  action={page.url.pathname}
  class="relative min-w-0 flex-1 basis-64 {className}"
  onsubmit={(event) => {
    event.preventDefault();
    apply(text);
  }}
>
  {#each kept as [key, keptValue] (`${key}=${keptValue}`)}
    <input type="hidden" name={key} value={keptValue} />
  {/each}
  <Icon
    name="search"
    size={18}
    class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
  />
  <input
    type="search"
    name="q"
    aria-label={label}
    {placeholder}
    {maxlength}
    autocomplete="off"
    bind:value={text}
    oninput={() => {
      clearTimeout(timer);
      timer = setTimeout(() => apply(text), 350);
    }}
    class="input h-11 w-full rounded-lg border-surface-200-800 bg-panel pr-3 pl-10"
  />
</form>
