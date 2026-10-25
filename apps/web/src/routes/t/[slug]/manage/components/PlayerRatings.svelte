<script lang="ts">
  // "Avalie quem jogou": quem mestra rates each person they marked present, once per table. A
  // one-shot once its session is confirmed; a campaign or adventure whenever the GM likes.
  import { m } from '#lib/paraglide/messages.js';
  import PlayerRatingRow from './PlayerRatingRow.svelte';

  let {
    next,
    goingOn,
    players,
  }: {
    next: string;
    /** A campaign or adventure that goes on: the title and lede say "when you like". */
    goingOn: boolean;
    players: {
      playerId: string;
      username: string;
      avatarUrl: string | null;
      tablesPlayed: number;
      /** Marked present by the GM (`markedPresent`): only these can be rated. */
      markedPresent: boolean;
      playerRating: number | null;
    }[];
  } = $props();

  const present = $derived(players.filter((player) => player.markedPresent));
</script>

{#if present.length > 0}
  <section
    aria-labelledby="player-ratings"
    class="rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6"
  >
    <h2 id="player-ratings" class="text-2xl font-semibold">
      {goingOn ? m.player_rating_title_going() : m.player_rating_title()}
    </h2>
    <p class="mt-2 text-muted">{goingOn ? m.player_rating_lede_going() : m.player_rating_lede()}</p>
    <p class="mt-1 text-sm text-muted">{m.player_rating_rule()}</p>
    <ul class="mt-3">
      {#each present as player (player.playerId)}
        <PlayerRatingRow {next} {player} />
      {/each}
    </ul>
  </section>
{/if}
