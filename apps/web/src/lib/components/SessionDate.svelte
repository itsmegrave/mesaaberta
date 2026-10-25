<script lang="ts">
  import { formatSession } from '@mesaaberta/core/tables/format';
  import { dateBox } from '#lib/tables/format.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  // The head of a table's summary (the table page's aside, the manage page's): the calendar tile,
  // "Próxima sessão" and the session in the viewer's zone, then the table's state once it is past
  // the open one. `large` is the table page's bigger type.
  let {
    startsAt,
    timezone,
    stateLabel,
    large = false,
  }: { startsAt: Date; timezone: string; stateLabel?: string | null; large?: boolean } = $props();

  const locale = getLocale();
  const zone = $derived(shownTimezone(timezone));
  const box = $derived(dateBox(startsAt, zone, locale));
</script>

<div class="flex items-start gap-4">
  <div
    aria-hidden="true"
    class="flex w-16 shrink-0 flex-col items-center rounded-lg preset-filled-primary-500 py-2 leading-none"
  >
    <span class="text-xs font-bold tracking-wide uppercase">{box.weekday}</span>
    <span class="mt-1 {large ? 'text-3xl' : 'text-2xl'} font-bold">{box.day}</span>
    <span class="mt-1 text-xs font-bold tracking-wide uppercase">{box.month}</span>
  </div>
  <div>
    <p class="text-sm font-semibold text-muted">{m.table_next_session()}</p>
    <p class="mt-1 {large ? 'text-xl' : 'text-lg'} leading-snug font-semibold">
      {formatSession(startsAt, zone, locale)}
    </p>
    {#if stateLabel}
      <p class="mt-1 text-sm font-semibold text-muted">{stateLabel}</p>
    {/if}
  </div>
</div>
