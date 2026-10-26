<script lang="ts">
  import { page } from '$app/state';
  import { indexingPolicy } from './policy.js';
  import { publicMetadata } from './metadata.js';
  const origin = $derived(page.data.site?.APP_ORIGIN ?? 'http://localhost:5173');
  const policy = $derived(
    indexingPolicy(page.url, origin, {
      status: page.status,
      maintenance: !!page.data.maintenance,
      draft: page.data.table?.status === 'draft' || page.data.post?.unpublished,
    }),
  );
  const metadata = $derived(
    policy.canonical
      ? publicMetadata(
          page.url.pathname,
          { table: page.data.table, profile: page.data.profile, post: page.data.post },
          origin,
        )
      : null,
  );
</script>

<svelte:head>
  {#if !policy.index}<meta name="robots" content="noindex, follow" />{/if}
  {#if policy.canonical}<link rel="canonical" href={policy.canonical} />{/if}
  {#if metadata}
    <title>{metadata.title}</title>
    <meta name="description" content={metadata.description} />
    <meta property="og:title" content={metadata.title} />
    <meta property="og:description" content={metadata.description} />
    <meta property="og:url" content={policy.canonical!} />
    <meta property="og:type" content={metadata.type} />
    <meta property="og:site_name" content="Mesa Aberta" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:image" content={metadata.image} />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={metadata.title} />
    <meta name="twitter:description" content={metadata.description} />
    <meta name="twitter:image" content={metadata.image} />
  {/if}
</svelte:head>
