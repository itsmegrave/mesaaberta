<script lang="ts">
  // "Sessões" on the table page of a campaign or adventure (`use_table_sessions`): the next dates
  // (three, then "Ver todas as sessões") and, for the table, the ones already played with their
  // outcome and the viewer's own attendance. A visitor sees the dates and how many were played.
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import { splitSessions, type SessionItem as Session } from '#lib/tables/sessions.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { m } from '#lib/paraglide/messages.js';
  import SessionItem from './ui/SessionItem.svelte';
  import SessionBadges from './ui/SessionBadges.svelte';

  let {
    sessions,
    timezone,
    repeat,
    seated,
    class: className = '',
  }: {
    sessions: Session[];
    timezone: string;
    /** How often it plays ("Toda semana"), when it has a rule. */
    repeat: string | null;
    /** Quem mestra or a confirmed player: the sessions behind, with notes and attendance. */
    seated: boolean;
    class?: string;
  } = $props();

  const SHOWN = 3;
  const zone = $derived(shownTimezone(timezone));
  const offset = $derived(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? zone,
  );
  const split = $derived(splitSessions(sessions));
  let all = $state(false);
  const upcoming = $derived(all ? split.upcoming : split.upcoming.slice(0, SHOWN));
  const played = $derived(split.past.filter((session) => session.status !== 'cancelled').length);
</script>

<section aria-labelledby="sessions" class={className}>
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <h2 id="sessions" class="text-2xl font-semibold">{m.sessions_title()}</h2>
    <span class="text-sm text-muted"
      >{repeat
        ? m.sessions_subtitle_repeat({ repeat, offset })
        : m.sessions_subtitle({ offset })}</span
    >
  </div>

  {#if split.upcoming.length > 0}
    <h3 class="mt-4 text-lg font-semibold">{m.sessions_upcoming()}</h3>
    <ul aria-label={m.sessions_upcoming_label()}>
      {#each upcoming as session, index (session.id)}
        <SessionItem {session} timezone={zone} last={index === upcoming.length - 1} />
      {/each}
    </ul>
    {#if split.upcoming.length > SHOWN}
      <button
        type="button"
        class="inline-flex min-h-11 items-center font-semibold text-link"
        aria-expanded={all}
        onclick={() => (all = !all)}>{all ? m.sessions_show_fewer() : m.sessions_show_all()}</button
      >
    {/if}
  {/if}

  {#if split.past.length > 0}
    {#if seated}
      <MAAccordion class="mt-2 border-t border-surface-200-800">
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
    {:else if played > 0}
      <p class="mt-2 text-sm text-muted">{m.sessions_played({ count: played })}</p>
    {/if}
  {/if}
</section>
