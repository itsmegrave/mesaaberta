<script lang="ts">
  // The head every admin page opens with: the "ADMIN" eyebrow, the section's name, one line saying
  // what it is for, the page's own actions on the right (Atualizar, Nova tag) and, beside the title,
  // the KebabMenu where the page has secondary actions. On a phone the "Seção: …" menu comes under
  // the lede.
  import type { Snippet } from 'svelte';
  import AdminSectionMenu from '$lib/components/admin/AdminSectionMenu.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import { m } from '$lib/paraglide/messages';

  let {
    title,
    lede,
    eyebrow = m.nav_admin(),
    menu,
    lead,
    status,
    children,
  }: {
    title: string;
    lede?: string;
    /** "ADMIN" on a section; a detail page says what it is ("Denúncia · recebida hoje, 09:12"). */
    eyebrow?: string;
    /** The page's secondary actions, as the KebabMenu beside the title. */
    menu?: KebabItem[];
    /** Before the title: a person's picture on their page. */
    lead?: Snippet;
    /** Under the title: the state of what the page is about. */
    status?: Snippet;
    /** The page actions (Atualizar, Nova tag…), on the right. */
    children?: Snippet;
  } = $props();
</script>

<header class="grid gap-4 md:flex md:flex-wrap md:items-end md:justify-between md:gap-x-4">
  <div class="flex min-w-0 items-center gap-4">
    {#if lead}{@render lead()}{/if}
    <div class="min-w-0">
      <p class="hidden text-sm font-semibold tracking-wide text-muted uppercase md:block">
        {eyebrow}
      </p>
      <div class="flex items-center gap-1 md:mt-1">
        <h1
          class="min-w-0 text-3xl leading-tight font-semibold tracking-tight text-balance wrap-break-word md:text-4xl"
        >
          {title}
        </h1>
        {#if menu && menu.length > 0}<KebabMenu name={title} items={menu} />{/if}
      </div>
      {#if status}<div class="mt-2">{@render status()}</div>{/if}
      {#if lede}<p class="mt-2 max-w-2xl text-surface-700-300">{lede}</p>{/if}
    </div>
  </div>
  <AdminSectionMenu />
  {#if children}
    <div class="flex flex-wrap items-center gap-2">{@render children()}</div>
  {/if}
</header>
