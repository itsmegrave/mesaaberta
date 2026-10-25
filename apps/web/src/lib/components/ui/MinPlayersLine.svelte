<script lang="ts">
  // The line under the SeatDots of a table with a minimum: "Precisa de 3 para acontecer · faltam 2"
  // in the warning ink until enough people are in, then "Mínimo atingido" with a check.
  import Icon from './Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    minPlayers,
    taken,
    class: className = '',
  }: { minPlayers: number; taken: number; class?: string } = $props();

  const met = $derived(taken >= minPlayers);
</script>

<p class="flex items-center gap-2 text-sm font-semibold {met ? '' : 'text-lamp'} {className}">
  {#if met}
    <Icon name="check" size={16} class="shrink-0 text-success-500" />{m.table_min_players_met()}
  {:else}
    <Icon name="info" size={16} class="shrink-0" />{m.table_min_players_needed({
      count: minPlayers,
    })} · {m.table_min_players_left({ count: minPlayers - taken })}
  {/if}
</p>
