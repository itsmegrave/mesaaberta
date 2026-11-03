<script lang="ts">
  import type { Snippet } from 'svelte';
  import { dateBox } from '#lib/tables/format.js';
  import { sessionDay, shortDay, type SessionItem } from '#lib/tables/sessions.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  // One row of a table's sessions (the table page's Sessões, Gerenciar mesa's): the calendar tile,
  // "Sessão 5", the day (and the time while it is ahead), the note and where a moved session was.
  // `badges` are the outcome and the viewer's attendance; `actions` quem mestra's menu; `details`
  // goes under the text (a campanha aberta's places).
  let {
    session,
    timezone,
    last = false,
    badges,
    actions,
    details,
  }: {
    session: SessionItem;
    /** The zone the viewer reads times in. */
    timezone: string;
    /** The last row has no line under it. */
    last?: boolean;
    badges?: Snippet;
    actions?: Snippet;
    details?: Snippet;
  } = $props();

  const locale = getLocale();
  const ahead = $derived(session.status === 'scheduled');
  const box = $derived(dateBox(session.startsAt, timezone, locale));
</script>

<li class="flex items-center gap-4 py-3 {last ? '' : 'border-b border-surface-200-800'}">
  <div
    aria-hidden="true"
    class="flex h-15 w-14 shrink-0 flex-col items-center justify-center rounded-lg leading-none {ahead
      ? 'preset-filled-primary-500'
      : 'bg-surface-wash text-muted'}"
  >
    <span class="text-xs font-semibold tracking-wide uppercase">{box.weekday}</span>
    <span class="text-2xl font-bold">{box.day}</span>
    <span class="text-xs font-semibold tracking-wide uppercase">{box.month}</span>
  </div>
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class="text-sm font-semibold text-muted"
      >{m.sessions_number({ number: session.number })}</span
    >
    <span class="font-semibold">{sessionDay(session.startsAt, timezone, locale, ahead)}</span>
    {#if session.note}
      <span class="text-sm leading-snug whitespace-pre-line text-muted">{session.note}</span>
    {/if}
    {#if ahead && session.movedFrom}
      <span class="text-sm text-muted"
        >{m.sessions_moved_from({ date: shortDay(session.movedFrom, timezone, locale) })}</span
      >
    {/if}
    {#if !ahead && session.present}
      <span class="text-sm text-muted"
        >{m.sessions_present({ count: session.present.count, of: session.present.of })}</span
      >
    {/if}
    {@render details?.()}
  </div>
  {#if badges || actions}
    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {@render badges?.()}
      {@render actions?.()}
    </div>
  {/if}
</li>
