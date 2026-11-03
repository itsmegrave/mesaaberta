<script lang="ts">
  import type { ProfileDecorationProps } from '#lib/extensions/decoration-types.js';
  import { loadDecoration } from '#lib/extensions/load-decoration.js';
  import { personDecorations } from './decorations.svelte';

  /** The mark an installed extension puts on this person's public profile, if any. */
  let { username }: { username: string } = $props();

  const decorations = personDecorations(() => username);
  const mark = $derived(decorations.current?.profile);
</script>

{#if mark}
  {#await loadDecoration<ProfileDecorationProps>(mark.kind) then Mark}
    {#if Mark}
      <Mark data={mark.data} {username} />
    {/if}
  {/await}
{/if}
