<script lang="ts">
  import Icon from '#lib/components/ui/Icon.svelte';
  import { formatSession } from '@mesaaberta/core/tables/format';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  // The dashboard cards' "Próxima sessão" line, in the zone the viewer reads the table in.
  let { startsAt, timezone }: { startsAt: Date; timezone: string } = $props();

  const locale = getLocale();
</script>

<p class="mt-4 flex items-start gap-2">
  <Icon name="calendar" size={18} class="mt-1" />
  <span>
    <span class="font-semibold">{m.table_next_session()}:</span>
    {formatSession(startsAt, shownTimezone(timezone), locale)}
  </span>
</p>
