<script lang="ts">
  // The frame of an admin page: the breadcrumbs (Início / Admin / section) and the head. Every page
  // of the admin opens with it, so they share one rhythm.
  import type { Snippet } from 'svelte';
  import AdminPageHead from '$lib/components/AdminPageHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import type { KebabItem } from '$lib/components/KebabMenu.svelte';
  import { m } from '$lib/paraglide/messages';

  let {
    title,
    lede,
    eyebrow,
    crumbs,
    menu,
    lead,
    status,
    actions,
    children,
  }: {
    /** The section's name; on a detail page, what it is about. */
    title: string;
    lede?: string;
    eyebrow?: string;
    /** The levels after "Início": by default Admin and the section named like the title. */
    crumbs?: { label: string; href?: string }[];
    menu?: KebabItem[];
    lead?: Snippet;
    status?: Snippet;
    /** The page actions, on the right of the head. */
    actions?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<section class="py-6 md:py-8">
  <Breadcrumbs
    items={crumbs ?? [{ label: m.nav_admin(), href: '/admin' }, { label: title }]}
    class="mb-6"
  />
  <AdminPageHead {title} {lede} {eyebrow} {menu} {lead} {status} children={actions} />
  {@render children?.()}
</section>
