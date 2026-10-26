<script lang="ts">
  // Suas próximas sessões: up to three, as quem joga or quem mestra, soonest first. Open when one
  // is this week; closed, its header names the next one.
  import { routes } from '@mesaaberta/core/routes';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { m } from '#lib/paraglide/messages.js';
  import { shortWhen, sessionTile, zoneLabel } from '../home-format';
  import HomePanel from './HomePanel.svelte';

  type Session = {
    slug: string;
    title: string;
    startsAt: Date;
    timezone: string;
    /** As its GM; otherwise with a seat. */
    running: boolean;
  };
  let {
    sessions,
    now,
    open = false,
  }: { sessions: Session[]; now: Date; /** A session this week. */ open?: boolean } = $props();

  const zone = $derived(shownTimezone(sessions[0]?.timezone ?? 'America/Sao_Paulo'));
  const summary = $derived(
    sessions[0]
      ? m.home_sessions_summary({
          count: sessions.length,
          when: shortWhen(sessions[0].startsAt, zone),
        })
      : undefined,
  );
</script>

<HomePanel value="sessions" title={m.home_sessions_title()} {summary} {open}>
  {#snippet aside()}
    <p class="flex flex-wrap items-baseline justify-between gap-3 text-sm">
      <span class="text-muted">{m.home_sessions_timezone({ zone: zoneLabel(zone, now) })}</span>
      <a href={routes.myTables} class="font-semibold">{m.nav_my_tables()}</a>
    </p>
  {/snippet}
  <ul class="flex flex-col gap-3">
    {#each sessions as session (`${session.running}-${session.slug}`)}
      {@const tile = sessionTile(session.startsAt, zone)}
      <li>
        <a
          href={routes.table(session.slug)}
          class="flex items-center gap-4 rounded-lg border border-surface-200-800 p-3 text-surface-950-50 no-underline hover:bg-surface-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          <span class="flex w-20 shrink-0 flex-col text-center">
            <span class="text-lg leading-tight font-semibold">{tile.day}</span>
            <span class="text-xs text-muted">{tile.time}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{session.title}</span>
            <span class="block text-sm text-muted"
              >{session.running ? m.home_sessions_role_gm() : m.home_sessions_role_player()}</span
            >
          </span>
        </a>
      </li>
    {/each}
  </ul>
</HomePanel>
