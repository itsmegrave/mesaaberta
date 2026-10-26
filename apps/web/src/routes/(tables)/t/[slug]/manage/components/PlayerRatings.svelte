<script lang="ts">
  // "Avalie quem jogou": quem mestra rates each person they marked present, once per table. A
  // one-shot once its session is confirmed; a campaign or adventure whenever the GM likes.
  import { m } from '#lib/paraglide/messages.js';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
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
  const rated = $derived(present.filter((player) => player.playerRating !== null).length);
  // Open while someone is still to rate: that is the thing to do on this page.
  // svelte-ignore state_referenced_locally
  let open = $state(rated < present.length ? ['player-ratings'] : []);
</script>

{#if present.length > 0}
  <section class="rounded-lg border border-surface-200-800 bg-panel p-4 md:p-5">
    <MAAccordion collapse="phone" bind:value={open}>
      <MAAccordionItem
        value="player-ratings"
        title={goingOn ? m.player_rating_title_going() : m.player_rating_title()}
        summary={m.player_rating_summary({ rated, total: present.length })}
        summaryOnWide
        titleClass="text-xl font-semibold md:text-2xl"
      >
        <p class="text-muted">
          {goingOn ? m.player_rating_lede_going() : m.player_rating_lede()}
        </p>
        <p class="mt-1 text-sm text-muted">{m.player_rating_rule()}</p>
        <ul class="mt-3">
          {#each present as player (player.playerId)}
            <PlayerRatingRow {next} {player} />
          {/each}
        </ul>
      </MAAccordionItem>
    </MAAccordion>
  </section>
{/if}
