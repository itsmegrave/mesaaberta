<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import type { Snippet } from 'svelte';
  import Prose from './Prose.svelte';

  let {
    title,
    updated,
    children,
  }: { title: string; updated: { iso: string; label: string }; children: Snippet } = $props();
</script>

<article class="mx-auto max-w-prose py-8 md:py-14">
  <Breadcrumbs items={[{ label: title }]} class="mb-6" />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {title}
  </h1>
  <p class="mt-3 text-muted">
    Última atualização: <time datetime={updated.iso}>{updated.label}</time>
  </p>
  <Prose class="mt-8 md:mt-10">
    {@render children()}
  </Prose>
</article>
