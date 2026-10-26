<script lang="ts">
  // The head of one part of "Editar perfil": its title, one line on what it holds and, where it
  // has one, a link on the right.
  import type { Snippet } from 'svelte';

  let { title, lede, aside }: { title: string; lede: string; aside?: Snippet } = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-3">
  <div class="min-w-0">
    <h2 class="text-2xl leading-tight font-semibold tracking-tight">{title}</h2>
    <p class="mt-1 max-w-prose text-muted">{lede}</p>
  </div>
  {@render aside?.()}
</header>
