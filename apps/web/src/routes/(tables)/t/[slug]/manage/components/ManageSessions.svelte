<script lang="ts">
  // Gerenciar mesa → Sessões (`use_table_sessions`), for a campaign or adventure: "Agendar sessão",
  // the sessions ahead with their menu (Mudar data, Escrever nota, Cancelar sessão) and the ones
  // already played, with their outcome and how many came. Changing one leaves the others alone.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import KebabMenu from '#lib/components/ui/KebabMenu.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import { localInput, splitSessions, type SessionItem as Session } from '#lib/tables/sessions.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { m } from '#lib/paraglide/messages.js';
  import SessionItem from '../../components/ui/SessionItem.svelte';
  import SessionBadges from '../../components/ui/SessionBadges.svelte';
  import SessionDialog, { type SessionDialogMode } from './SessionDialog.svelte';

  let {
    sessions,
    next,
    timezone,
    weekly,
    durationHours,
    canSchedule,
    class: className = '',
  }: {
    sessions: Session[];
    /** The manage page. */
    next: string;
    timezone: string;
    /** A weekly campaign keeps its next dates written out: the intro says so. */
    weekly: boolean;
    durationHours: number;
    /** The table takes changes now (active or waiting for the GM's answer). */
    canSchedule: boolean;
    class?: string;
  } = $props();

  const zone = $derived(shownTimezone(timezone));
  const split = $derived(splitSessions(sessions));
  const now = new Date();
  const WEEK = 7 * 24 * 3_600_000;
  // "Agendar sessão" starts a week after the last date ahead, at its time.
  const suggested = $derived.by(() => {
    const last = split.upcoming.at(-1);
    return last ? localInput(new Date(last.startsAt.getTime() + WEEK), timezone) : '';
  });

  let dialog = $state<{ mode: SessionDialogMode; session: Session | null } | null>(null);
  const open = (mode: SessionDialogMode, session: Session | null = null) =>
    (dialog = { mode, session });

  const menu = (session: Session) => [
    {
      id: 'move',
      label: m.sessions_move(),
      icon: 'calendar' as const,
      onselect: () => open('move', session),
    },
    {
      id: 'note',
      label: m.sessions_note(),
      icon: 'square-pen' as const,
      onselect: () => open('note', session),
    },
    ...(split.upcoming.filter((other) => other.startsAt > now).length > 1
      ? [
          {
            id: 'cancel',
            label: m.sessions_cancel_item(),
            icon: 'xmark' as const,
            destructive: true,
            onselect: () => open('cancel', session),
          },
        ]
      : []),
  ];
</script>

<section aria-labelledby="manage-sessions" class={className}>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 id="manage-sessions" class="text-2xl font-semibold">{m.sessions_title()}</h2>
    {#if canSchedule}
      <MAButton
        variant="primary"
        class="font-semibold max-md:w-full"
        onclick={() => open('schedule')}
      >
        <Icon name="plus" size={18} />
        {m.sessions_schedule()}
      </MAButton>
    {/if}
  </div>
  <p class="mt-2 text-muted">{weekly ? m.sessions_intro_weekly() : m.sessions_intro()}</p>

  <h3 class="mt-4 text-lg font-semibold">{m.sessions_upcoming()}</h3>
  {#if split.upcoming.length > 0}
    <ul aria-label={m.sessions_upcoming_label()}>
      {#each split.upcoming as session, index (session.id)}
        <SessionItem {session} timezone={zone} last={index === split.upcoming.length - 1}>
          {#snippet actions()}
            <!-- The session that passed waits for the answer above: nothing to change here. -->
            {#if canSchedule && session.startsAt > now}
              <KebabMenu
                name={m.sessions_actions({ number: session.number })}
                items={menu(session)}
              />
            {/if}
          {/snippet}
        </SessionItem>
      {/each}
    </ul>
  {:else}
    <p class="mt-2 text-sm text-muted">{m.sessions_none_upcoming()}</p>
  {/if}

  {#if split.past.length > 0}
    <MAAccordion collapse="phone" class="mt-4 border-t border-surface-200-800 md:border-0">
      <MAAccordionItem
        value="past"
        level={3}
        title={m.sessions_past_count({ count: split.past.length })}
      >
        <ul aria-label={m.sessions_past_label()}>
          {#each split.past as session, index (session.id)}
            <SessionItem {session} timezone={zone} last={index === split.past.length - 1}>
              {#snippet badges()}<SessionBadges {session} />{/snippet}
            </SessionItem>
          {/each}
        </ul>
      </MAAccordionItem>
    </MAAccordion>
  {/if}
</section>

{#if dialog}
  <SessionDialog
    mode={dialog.mode}
    session={dialog.session}
    {next}
    {timezone}
    {durationHours}
    {suggested}
    onclose={() => (dialog = null)}
  />
{/if}
