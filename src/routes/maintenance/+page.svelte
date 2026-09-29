<script lang="ts">
  import { m } from '$lib/paraglide/messages';
</script>

<svelte:head>
  <title>{m.maintenance_title()} · Mesa Aberta</title>
</svelte:head>

<section class="py-16 md:py-24">
  <h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.maintenance_title()}</h1>
  <p class="mt-4 max-w-md text-lg">{m.maintenance_text()}</p>
</section>
