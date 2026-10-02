<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages';
  import Breadcrumbs from './Breadcrumbs.svelte';
  import TableIllustration from './TableIllustration.svelte';

  // The frame of the sign-in pages (login, sign-up, password): the blue panel with the table on large
  // screens, and the page's own content on the right.
  // `parents` are the levels between "Início" and the page, for the password pages that sit under "Entrar".
  let {
    title,
    lede,
    parents = [],
    children,
  }: {
    title: string;
    lede?: string;
    parents?: { label: string; href: string }[];
    children: Snippet;
  } = $props();
</script>

<Breadcrumbs items={[...parents, { label: title }]} class="pt-2 md:pt-6" />
<section class="grid items-center gap-10 py-6 md:pt-8 lg:grid-cols-2 lg:gap-24">
  <div
    class="relative hidden h-160 flex-col items-center justify-center gap-7 overflow-hidden rounded-lg bg-primary-500 p-10 text-white lg:flex"
  >
    <span aria-hidden="true" class="absolute -top-28 -right-28 size-80 rounded-full bg-white/5"
    ></span>
    <div class="relative w-80"><TableIllustration onBrand /></div>
    <p
      class="relative max-w-xs text-center text-4xl leading-none font-semibold tracking-tight text-balance"
    >
      {m.hero_title()}
    </p>
  </div>

  <div class="min-w-0">
    <h1 class="text-5xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
      {title}
    </h1>
    {#if lede}<p class="mt-2 max-w-sm text-lg text-muted md:mt-3 md:max-w-md md:text-xl">
        {lede}
      </p>{/if}
    <div class="mt-7 w-full max-w-md md:mt-8">
      {@render children()}
    </div>
  </div>
</section>
