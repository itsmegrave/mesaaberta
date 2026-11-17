<script lang="ts">
  import type { MatchPerson } from '@mesaaberta/core/server/matches/service';
  import { MATCH_AXES, type MatchAxes } from '@mesaaberta/core/matches/schema';
  import { routes } from '@mesaaberta/core/routes';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { cardLine } from '../person';
  import AxisCompare from './AxisCompare.svelte';

  // "Ver mais": the whole card as a sheet, with each axis beside the viewer's own mark, and the
  // way to the profile (where Bloquear and Denunciar are).
  let {
    open = $bindable(false),
    person,
    mine,
  }: { open: boolean; person: MatchPerson; mine: MatchAxes | null } = $props();

  const systems = $derived([...person.commonSystems, ...person.otherSystems].map((s) => s.name));
</script>

<DialogShell bind:open sheet scroll title={`@${person.username}`} description={cardLine(person)}>
  <div class="grid gap-5">
    {#if systems.length > 0}
      <p class="text-sm">
        <span class="font-semibold">{m.match_more_systems()}</span>
        {systems.join(', ')}{person.moreSystems > 0 ? ` +${person.moreSystems}` : ''}
      </p>
    {/if}
    <div class="grid gap-2 rounded-lg bg-punk-paper p-3">
      <p class="flex justify-between text-sm font-semibold text-punk-ink">
        <span>{m.match_more_style()}</span>
        {#if mine}<span class="font-medium">{m.match_more_you()}</span>{/if}
      </p>
      {#each MATCH_AXES as { key } (key)}
        <AxisCompare axis={key} value={person.axes[key]} mine={mine ? mine[key] : null} />
      {/each}
    </div>
    <p class="text-sm text-muted">
      {m.match_more_safety()}
      <a class="anchor" href={routes.profile(person.username)}>{m.match_more_profile()}</a>
    </p>
  </div>
</DialogShell>
