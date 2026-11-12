<script lang="ts">
  import { routes } from '@mesaaberta/core/routes';
  import { MATCH_DAILY_ANSWERS } from '@mesaaberta/core/matches/schema';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { SWIPE_AT, deckState, swipe } from './components/deck.svelte';
  import MatchIt from './components/ui/MatchIt.svelte';
  import MoreSheet from './components/ui/MoreSheet.svelte';
  import RoundButton from './components/ui/RoundButton.svelte';
  import SwipeCard from './components/ui/SwipeCard.svelte';

  let { data } = $props();

  const ready = $derived(data.deck.state === 'ready' ? data.deck : null);
  const deck = deckState(
    () => ready?.people ?? [],
    () => ready?.answersLeft ?? 0,
  );
  const top = $derived(deck.people[0] ?? null);
  const left = $derived(Math.max(0, (ready?.answersLeft ?? 0) - deck.used));
  let dx = $state(0);
  let more = $state(false);
  const stamp = $derived(
    dx >= SWIPE_AT / 2 ? ('yes' as const) : dx <= -SWIPE_AT / 2 ? ('no' as const) : null,
  );
  const attach = swipe(() => ({
    onmove: (value) => (dx = value),
    onanswer: (yes) => deck.answer(yes),
    onmore: () => (more = true),
    disabled: deck.busy || more || deck.matched !== null,
  }));

  // ← Agora não, → Quero jogar junto, ↑ Ver mais, Backspace Voltar a última; not while typing
  // or with a dialog open.
  function onkeydown(event: KeyboardEvent) {
    if (!top || more || deck.matched || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
    const action = {
      ArrowLeft: () => deck.answer(false),
      ArrowRight: () => deck.answer(true),
      ArrowUp: () => (more = true),
      Backspace: () => deck.canUndo(ready?.canUndo ?? false) && deck.undo(),
    }[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }
</script>

<svelte:head><title>{m.match_title()} · Mesa Aberta</title></svelte:head>
<svelte:window {onkeydown} />

<section class="py-2 md:pt-12">
  <PageHead crumbs={[{ label: m.nav_matches() }]} title={m.match_title()} lede={m.match_lede()}>
    {#snippet actions()}
      <div class="flex flex-wrap gap-2">
        <a href={routes.matchList} class={buttonClass('secondary')}>{m.match_list_link()}</a>
        <a href={routes.matchCard} class={buttonClass('ghost')}>{m.match_card_link()}</a>
      </div>
    {/snippet}
  </PageHead>

  <div class="mt-8">
    {#if data.deck.state === 'not_adult'}
      <DirectoryEmpty title={m.match_not_adult_title()} hint={m.match_not_adult_hint()} />
    {:else if data.deck.state === 'no_card'}
      <DirectoryEmpty
        title={m.match_no_card_title()}
        hint={m.match_no_card_hint()}
        href={routes.matchCard}
        action={m.match_no_card_action()}
      />
    {:else if data.deck.state === 'off'}
      <DirectoryEmpty
        title={m.match_off_title()}
        hint={m.match_off_hint()}
        href={routes.matchCard}
        action={m.match_off_action()}
      />
    {:else if top}
      <section
        aria-label={m.match_deck_label()}
        class="mx-auto flex max-w-sm flex-col items-center"
      >
        <!-- The card on top, with the next one peeking out behind it. -->
        <div class="relative h-136 w-full md:h-144">
          {#if deck.people[1]}
            <div
              aria-hidden="true"
              class="absolute inset-0 translate-y-2 scale-95 rotate-2 opacity-70"
            >
              <SwipeCard person={deck.people[1]} compact />
            </div>
          {/if}
          {#key top.username}
            <div
              {@attach attach}
              class="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
            >
              <SwipeCard person={top} compact {stamp} />
            </div>
          {/key}
        </div>

        <div class="mt-8 flex items-center justify-center gap-4">
          <RoundButton
            kind="undo"
            icon="undo-2"
            label={m.match_undo()}
            disabled={deck.busy || !deck.canUndo(ready?.canUndo ?? false)}
            onclick={deck.undo}
          />
          <RoundButton
            kind="no"
            icon="xmark"
            label={m.match_no()}
            big
            disabled={deck.busy}
            onclick={() => deck.answer(false)}
          />
          <RoundButton
            kind="yes"
            icon="game-icons:hearts"
            label={m.match_yes()}
            big
            disabled={deck.busy}
            onclick={() => deck.answer(true)}
          />
          <RoundButton
            kind="more"
            icon="arrow-up"
            label={m.match_more()}
            onclick={() => (more = true)}
          />
        </div>
        <p class="mt-5 text-center text-sm text-muted">
          {m.match_left({ count: left, total: MATCH_DAILY_ANSWERS })}
        </p>
        <p class="mt-1 hidden text-center text-xs text-muted md:block">{m.match_keys()}</p>
      </section>
      <MoreSheet bind:open={more} person={top} mine={data.mine} />
    {:else if left === 0}
      <DirectoryEmpty title={m.match_limit_title()} hint={m.match_limit_hint()} />
    {:else}
      <DirectoryEmpty
        title={m.match_empty_title()}
        hint={m.match_empty_hint()}
        href={routes.matchCard}
        action={m.match_empty_action()}
      />
    {/if}
  </div>
</section>

{#if deck.matched}
  <MatchIt person={deck.matched} onclose={deck.closeMatch} />
{/if}
