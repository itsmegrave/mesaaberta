<script lang="ts">
  import { Collapsible } from '@skeletonlabs/skeleton-svelte';
  import { atHandle } from '$lib/profile/handle';
  import { formatSession } from '$lib/tables/format';
  import { shownTimezone } from '$lib/time/shown-timezone';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import ActionForm from './ActionForm.svelte';
  import SeatDots from './SeatDots.svelte';

  type Person = { playerId: string; username: string };
  type Item = {
    slug: string;
    title: string;
    tableStatus: 'active' | 'disabled';
    capacity: number;
    timezone: string;
    nextAt: Date | null;
    players: Person[];
    requests: Person[];
  };

  type Props = {
    item: Item;
    next: string;
    /** Whether the player list starts open on a phone. From `lg` up it is always open. */
    openPlayers?: boolean;
  };

  let { item, next, openPlayers = false }: Props = $props();

  // svelte-ignore state_referenced_locally
  let playersOpen = $state(openPlayers);

  const locale = getLocale();
  const page = $derived(localizedHref(`/tables/${item.slug}`, locale));
</script>

<article
  id="mesa-{item.slug}"
  class="scroll-mt-6 rounded-lg border border-surface-200-800 bg-panel p-6"
>
  <p class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-muted">
    {#if item.tableStatus === 'disabled'}<span>{m.dash_disabled()}</span>{/if}
    <span class="ml-auto"
      >{m.dash_seats_taken({ taken: item.players.length, capacity: item.capacity })}</span
    >
  </p>

  <h3 class="mt-2 text-2xl leading-tight font-semibold tracking-tight">
    <a href={page} class="hover:underline">{item.title}</a>
  </h3>
  <p class="mt-3"><SeatDots taken={item.players.length} capacity={item.capacity} /></p>

  <p class="mt-4 flex items-start gap-2">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="mt-1 shrink-0"
      ><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path
        d="M3.5 10h17M8 3v4M16 3v4"
      /></svg
    >
    <span>
      {#if item.nextAt}
        <span class="font-semibold">{m.table_next_session()}:</span>
        {formatSession(item.nextAt, shownTimezone(item.timezone), locale)}
      {:else}
        {m.table_no_more_sessions()}
      {/if}
    </span>
  </p>

  <p class="mt-4 flex flex-wrap gap-3">
    <a
      href={localizedHref(`/tables/${item.slug}/manage`, locale)}
      class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold">{m.dash_manage()}</a
    >
    <a
      href={localizedHref(`/tables/${item.slug}/edit`, locale)}
      class="btn h-11 rounded-lg border-2 border-primary-500 px-4 font-semibold">{m.dash_edit()}</a
    >
  </p>

  {#if item.requests.length > 0}
    <div class="mt-5 rounded-lg bg-lamp-wash p-4">
      <h4 class="font-semibold">{m.dash_requests()} ({item.requests.length})</h4>
      <ul class="mt-2 grid gap-2">
        {#each item.requests as request (request.playerId)}
          <li
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-panel px-3 py-2"
          >
            <span>{atHandle(request.username)}</span>
            <div class="flex gap-4">
              {#each [['approve', m.table_approve(), 'preset-filled-primary-500', m.toast_approved()], ['decline', m.table_decline(), 'border-2 border-surface-200-800 text-error-alert', m.toast_declined()]] as [action, label, tone, success] (action)}
                <ActionForm
                  action="{page}?/{action}"
                  playerId={request.playerId}
                  {next}
                  {label}
                  buttonClass="btn h-10 rounded-lg px-4 font-semibold {tone}"
                  {success}
                />
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <Collapsible open={playersOpen} onOpenChange={(details) => (playersOpen = details.open)}>
    <!-- A heading on a wide screen, a button that folds the list on a phone. -->
    <h4 class="mt-5 font-semibold max-lg:hidden">{m.dash_players()}</h4>
    <Collapsible.Trigger
      class="mt-3 flex min-h-12 w-full items-center justify-between gap-3 text-left font-semibold lg:hidden"
    >
      {m.dash_players_count({ count: item.players.length })}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0 transition-transform {playersOpen ? 'rotate-180' : ''}"
        ><path d="m6 9 6 6 6-6" /></svg
      >
    </Collapsible.Trigger>
    <Collapsible.Content>
      {#snippet element(attributes)}
        <div {...attributes} hidden={false} class={playersOpen ? '' : 'max-lg:hidden'}>
          {#if item.players.length === 0}
            <p class="mt-1">{m.dash_none_yet()}</p>
          {:else}
            <ul class="mt-2 grid gap-2">
              {#each item.players as player (player.playerId)}
                <li
                  class="flex items-center justify-between gap-3 rounded-lg bg-surface-950-50/5 px-3 py-2"
                >
                  <span>{atHandle(player.username)}</span>
                  <ActionForm
                    action="{page}?/remove"
                    playerId={player.playerId}
                    {next}
                    label={m.table_remove()}
                    buttonClass="btn h-10 rounded-lg border-2 border-surface-200-800 px-4 font-semibold text-error-alert"
                    success={m.toast_removed()}
                  />
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/snippet}
    </Collapsible.Content>
  </Collapsible>
</article>
