<script lang="ts">
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { Collapsible } from '@skeletonlabs/skeleton-svelte';
  import type { TableStatus } from '#lib/tables/status.js';
  import { m } from '#lib/paraglide/messages.js';
  import { seatSummary } from '#lib/tables/format.js';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
  import NextSession from '#lib/components/ui/NextSession.svelte';
  import SeatDots from '#lib/components/ui/SeatDots.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';

  type Person = { playerId: string; username: string };
  type Item = {
    slug: string;
    title: string;
    tableStatus: TableStatus;
    capacity: number;
    reserved?: number;
    seatsLeft?: number;
    timezone: string;
    startsAt: Date;
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
  let endOpen = $state(false);

  const page = $derived(`/t/${item.slug}`);
  // Secondary and destructive actions live in the "3 dots", as on Gerenciar mesa.
  const menu = $derived<KebabItem[]>([
    {
      id: 'duplicate',
      label: m.table_duplicate(),
      icon: 'copy',
      href: `/tables/new?duplicate=${encodeURIComponent(item.slug)}`,
    },
    ...(['draft', 'active', 'awaiting_confirmation'].includes(item.tableStatus)
      ? [
          {
            id: 'end',
            label: item.tableStatus === 'draft' ? m.menu_delete_draft() : m.menu_close_table(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (endOpen = true),
          },
        ]
      : []),
  ]);
  const manage = $derived(`/t/${item.slug}/manage`);
</script>

<article
  id="mesa-{item.slug}"
  class="scroll-mt-6 rounded-lg border border-surface-200-800 bg-panel p-6"
>
  <p class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-muted">
    {#if item.tableStatus === 'draft'}
      <Pill tone="outline">{m.table_status_draft()}</Pill>
    {/if}
    <span class="ml-auto"
      >{m.dash_seats_taken({ taken: item.players.length, capacity: item.capacity })}</span
    >
  </p>
  {#if item.reserved}
    <p class="mt-2 text-sm text-muted">
      {seatSummary(
        item.players.length,
        item.reserved,
        item.seatsLeft ?? Math.max(0, item.capacity - item.players.length - item.reserved),
      )}
    </p>
  {/if}

  <!-- The date has passed: the GM says whether it happened. Table statuses are only for admin. -->
  {#if item.tableStatus === 'awaiting_confirmation'}
    <div
      role="group"
      aria-label={m.dash_session_prompt({ title: item.title })}
      class="mb-4 rounded-lg border-2 border-primary-500 p-4"
    >
      <p class="font-semibold">{m.dash_session_prompt({ title: item.title })}</p>
      <p class="mt-1 text-sm text-muted">{m.dash_session_prompt_text()}</p>
      <div class="mt-3 flex flex-wrap gap-3">
        <!-- "It happened" opens the attendance step on Gerenciar mesa: only who showed up rates and earns badges. -->
        <a
          href="{manage}?etapa=presenca#session-confirmation"
          class="{buttonClass('primary')} font-semibold">{m.dash_session_yes()}</a
        >
        <ActionForm
          action="{manage}?/notHeld"
          {next}
          label={m.dash_session_no()}
          buttonClass="{buttonClass('secondary')} font-semibold"
          success={m.toast_table_not_held()}
        />
      </div>
    </div>
  {/if}

  <h3 class="mt-2 text-2xl leading-tight font-semibold tracking-tight">
    <a href={page} class="hover:underline">{item.title}</a>
  </h3>
  <p class="mt-3">
    <SeatDots taken={item.players.length} capacity={item.capacity} reserved={item.reserved} />
  </p>

  <NextSession startsAt={item.startsAt} timezone={item.timezone} />

  <div class="mt-4 flex flex-wrap items-center gap-3">
    <a href={`/t/${item.slug}/manage`} class="{buttonClass('primary')} font-semibold"
      >{m.dash_manage()}</a
    >
    <a href={`/t/${item.slug}/edit`} class="{buttonClass('secondary')} font-semibold"
      >{m.dash_edit()}</a
    >
    <KebabMenu name={item.title} items={menu} class="ml-auto" />
  </div>

  <ConfirmDialog
    bind:open={endOpen}
    action="{manage}?/{item.tableStatus === 'draft' ? 'deleteDraft' : 'close'}"
    label={item.tableStatus === 'draft' ? m.table_delete_draft() : m.table_close()}
    title={item.tableStatus === 'draft' ? m.table_delete_draft_title() : m.table_close_title()}
    text={item.tableStatus === 'draft' ? m.table_delete_draft_text() : m.table_close_text()}
    success={item.tableStatus === 'draft' ? m.toast_table_deleted() : m.toast_table_closed()}
  />

  {#if item.requests.length > 0}
    <div class="mt-5 rounded-lg bg-lamp-wash p-4">
      <h4 class="font-semibold">{m.dash_requests()} ({item.requests.length})</h4>
      <ul class="mt-2 grid gap-2">
        {#each item.requests as request (request.playerId)}
          <li
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-panel px-3 py-2"
          >
            <span><UserLink username={request.username} /></span>
            <div class="flex gap-4">
              {#each [['approve', m.table_approve(), 'preset-filled-primary-500', m.toast_approved()], ['decline', m.table_decline(), 'border-2 border-surface-200-800 text-error-alert', m.toast_declined()]] as [action, label, tone, success] (action)}
                <ActionForm
                  action="{page}?/{action}"
                  playerId={request.playerId}
                  {next}
                  {label}
                  buttonClass="btn h-11 rounded-lg px-4 font-semibold {tone}"
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
      <Icon name="chevron-down" class="transition-transform {playersOpen ? 'rotate-180' : ''}" />
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
                  <span><UserLink username={player.username} /></span>
                  <ActionForm
                    action="{page}?/remove"
                    playerId={player.playerId}
                    {next}
                    label={m.table_remove()}
                    buttonClass="btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold text-error-alert"
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
