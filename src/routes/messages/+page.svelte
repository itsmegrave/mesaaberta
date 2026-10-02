<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages';
</script>

<svelte:head>
  <title>{m.messages_title()} · Mesa Aberta</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumbs items={[{ label: m.messages_title() }]} class="pt-2" />
<section class="md:flex md:h-full md:flex-col md:items-center md:justify-center md:py-24">
  <h1
    class="text-4xl leading-none font-semibold tracking-tight text-balance md:flex md:items-center md:gap-3 md:text-5xl"
  >
    <Icon name="message-circle" size={40} class="hidden text-muted md:block" />
    {m.messages_title()}
  </h1>
  <p class="mt-3 hidden max-w-md text-center text-muted md:block md:text-xl">
    {m.messages_lede()}
  </p>
</section>
