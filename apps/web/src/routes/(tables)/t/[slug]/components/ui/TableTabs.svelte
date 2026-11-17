<script lang="ts">
  // The two sections of a GM's table, as a segmented row on the wash: "Participantes e pedidos"
  // (with the requests waiting) and "Editar mesa"; "Ver a página da mesa" on the right.
  import CountBadge from '#lib/components/ui/CountBadge.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    slug,
    current,
    requests = 0,
    canEdit = true,
  }: {
    slug: string;
    current: 'players' | 'edit';
    /** Join requests waiting, counted beside "Participantes e pedidos". */
    requests?: number;
    canEdit?: boolean;
  } = $props();

  const tab = (active: boolean) =>
    `inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 font-semibold whitespace-nowrap no-underline ${
      active ? 'preset-filled-primary-500' : 'hover:bg-surface-wash'
    }`;
</script>

<div class="mt-6 flex flex-wrap items-center justify-between gap-4">
  <nav
    aria-label={m.manage_sections()}
    class="flex w-full gap-2 rounded-lg bg-surface-wash p-1 sm:w-110"
  >
    <a
      href="/t/{slug}/manage"
      aria-current={current === 'players' ? 'page' : undefined}
      class={tab(current === 'players')}
    >
      {m.manage_tab_players()}
      <CountBadge count={requests} max={99} class="h-6 min-w-6 px-2" />
    </a>
    {#if canEdit}
      <a
        href="/t/{slug}/edit"
        aria-current={current === 'edit' ? 'page' : undefined}
        class={tab(current === 'edit')}>{m.table_edit()}</a
      >
    {/if}
  </nav>
  <a href="/t/{slug}" class="hidden link-underline font-semibold sm:inline"
    >{m.manage_view_page()}</a
  >
</div>
