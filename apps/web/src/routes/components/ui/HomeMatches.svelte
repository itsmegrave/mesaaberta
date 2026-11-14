<script lang="ts">
  // Combinar on Início (`use_home_matches`). Someone who never made a card is invited to make one;
  // someone whose card is on sees the matches of the last days and how many cards wait in their
  // deck today. Open when there is something to do (an invitation, a new match, cards waiting);
  // closed, its header says it.
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { routes } from '@mesaaberta/core/routes';
  import { HOME_MATCHES_WAITING_MAX } from '@mesaaberta/core/matches/schema';
  import type { HomeMatches } from '@mesaaberta/core/server/matches/service';
  import { m } from '#lib/paraglide/messages.js';
  import HomePanel from './HomePanel.svelte';

  let { section }: { section: HomeMatches } = $props();

  const ready = $derived(section.state === 'ready' ? section : null);
  const waiting = $derived.by(() => {
    if (!ready || ready.waiting === 0) return null;
    return ready.waiting > HOME_MATCHES_WAITING_MAX
      ? m.home_matches_waiting_many({ count: HOME_MATCHES_WAITING_MAX })
      : m.home_matches_waiting({ count: ready.waiting });
  });
  const summary = $derived.by(() => {
    if (!ready) return m.home_matches_invite_summary();
    const parts = [
      ready.freshTotal > 0 ? m.home_matches_fresh({ count: ready.freshTotal }) : null,
      waiting,
    ].filter((part) => part !== null);
    if (parts.length > 0) return parts.join(' · ');
    return ready.answersLeft === 0 ? m.match_limit_title() : m.home_matches_quiet();
  });
  const open = $derived(!ready || ready.freshTotal > 0 || ready.waiting > 0);
  const more = $derived(ready ? ready.freshTotal - ready.fresh.length : 0);
</script>

{#snippet cardLink()}
  <a href={routes.matchCard} class="text-sm font-semibold">{m.match_card_link()}</a>
{/snippet}

<HomePanel
  value="matches"
  title={m.nav_matches()}
  {summary}
  {open}
  aside={ready ? cardLink : undefined}
>
  {#if !ready}
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <p class="max-w-xl">{m.home_matches_invite_text()}</p>
      <a href={routes.matchCard} class="{buttonClass('primary', 'sm')} shrink-0 gap-2 font-semibold"
        >{m.match_no_card_action()}</a
      >
    </div>
  {:else}
    <div class="flex flex-col gap-4">
      {#if ready.fresh.length > 0}
        <div class="flex flex-col gap-3">
          <p>{m.home_matches_fresh_text()}</p>
          <ul class="flex flex-wrap items-center gap-x-4 gap-y-2">
            {#each ready.fresh as person (person.username)}
              <li>
                <a
                  href={routes.profile(person.username)}
                  class="flex items-center gap-2 font-semibold text-surface-950-50"
                >
                  <MAAvatar src={person.avatarUrl} name={person.username} size={32} />
                  {atHandle(person.username)}
                </a>
              </li>
            {/each}
            {#if more > 0}
              <li class="text-sm text-muted">{m.home_matches_fresh_more({ count: more })}</li>
            {/if}
          </ul>
          <a
            href={routes.matchList}
            class="{buttonClass('secondary', 'sm')} self-start font-semibold"
            >{m.home_matches_fresh_action()}</a
          >
        </div>
      {/if}

      {#if waiting}
        <div
          class="flex flex-col gap-3 rounded-lg bg-surface-wash p-3 md:flex-row md:items-center md:justify-between md:p-4"
        >
          <p>
            <span class="block font-semibold">{waiting}</span>
            <span class="block text-sm text-muted">{m.home_matches_waiting_text()}</span>
          </p>
          <a href={routes.matches} class="{buttonClass('primary', 'sm')} shrink-0 font-semibold"
            >{m.home_matches_waiting_action()}</a
          >
        </div>
      {:else if ready.fresh.length === 0}
        <p class="text-muted">
          {ready.answersLeft === 0 ? m.match_limit_hint() : m.home_matches_quiet_text()}
        </p>
      {/if}
    </div>
  {/if}
</HomePanel>
