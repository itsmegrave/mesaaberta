<script lang="ts">
  import type { MatchPerson } from '@mesaaberta/core/server/matches/service';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { cornersOf } from '../suits';
  import { cardLine, seatOf } from '../person';
  import SuitBadge from './SuitBadge.svelte';

  let {
    person,
    compact = false,
    stamp = null,
  }: {
    person: MatchPerson;
    /** The phone card: two systems before "+N", shorter rating labels. */
    compact?: boolean;
    /** While it is dragged far enough: the answer it would give. */
    stamp?: 'yes' | 'no' | null;
  } = $props();

  const corners = $derived(cornersOf(person.axes));
  const badge = $derived(compact ? 48 : 56);
  const seat = $derived(seatOf(person.username));
  const extra = $derived(
    person.otherSystems.length + person.moreSystems > 0
      ? m.match_card_also({
          systems: person.otherSystems.map((s) => s.name).join(', '),
          more: person.moreSystems,
        })
      : '',
  );
  const commonChips = $derived(
    [
      person.commonSlots > 0
        ? { icon: 'clock' as const, text: m.match_common_slots({ count: person.commonSlots }) }
        : null,
      person.bothOnline ? { icon: 'globe' as const, text: m.match_common_online() } : null,
      person.sameCity && person.city ? { icon: 'map-pin' as const, text: person.city } : null,
    ].filter((chip) => chip !== null),
  );
</script>

<article
  aria-label={m.match_card_label({ user: `@${person.username}` })}
  class="punk-card absolute inset-0 flex flex-col overflow-hidden rounded-2xl border-4 border-punk-ink bg-punk-paper text-punk-ink select-none"
>
  <span class="absolute top-2.5 left-2.5 z-10">
    <SuitBadge pole={corners[0].pole} percent={corners[0].percent} size={badge} corner="top-left" />
  </span>
  <span class="absolute top-2.5 right-2.5 z-10">
    <SuitBadge
      pole={corners[1].pole}
      percent={corners[1].percent}
      size={badge}
      corner="top-right"
    />
  </span>

  <div
    class="punk-hero punk-seat-{seat} relative flex shrink-0 items-center justify-center"
    class:punk-compact={compact}
  >
    <span
      class="flex -rotate-4 rounded-full border-4 border-punk-ink shadow-[5px_5px_0_var(--color-punk-ink)]"
    >
      <MAAvatar src={person.avatarUrl} name={person.username} size={compact ? 120 : 128} />
    </span>
    {#if person.fit}
      <span
        class="absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 -rotate-4 items-center gap-1.5 rounded-md border-3 border-punk-ink bg-punk-yellow px-3.5 py-0.5 font-comic text-2xl whitespace-nowrap text-punk-ink shadow-[3px_3px_0_var(--color-punk-ink)]"
      >
        <Icon name="star" size={18} />
        {person.fit === 'great' ? m.match_fit_great() : m.match_fit_good()}
      </span>
    {/if}
    {#if stamp}
      <span
        aria-hidden="true"
        class="absolute top-16 z-20 rounded-md border-4 border-punk-ink px-3.5 font-comic text-4xl text-punk-ink {stamp ===
        'yes'
          ? 'left-5 -rotate-14 bg-punk-yellow shadow-[5px_5px_0_var(--color-punk-pink)]'
          : 'right-5 rotate-14 bg-punk-paper shadow-[5px_5px_0_var(--color-punk-ink)]'}"
      >
        {stamp === 'yes' ? m.match_stamp_yes() : m.match_stamp_no()}
      </span>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-2.5 px-4 pt-1.5">
    <div>
      <h2
        class="inline-block -rotate-1 border-2 border-punk-ink bg-punk-yellow px-2 font-comic text-3xl leading-tight tracking-wide"
      >
        @{person.username}
      </h2>
      <p class="mt-1 text-sm font-semibold">{cardLine(person)}</p>
    </div>

    {#if person.gm || person.player}
      <div class="flex flex-wrap gap-x-4 gap-y-2">
        {#if person.gm}
          {@render rating(person.gm.score, person.gm.count, m.match_rating_gm())}
        {/if}
        {#if person.player}
          {@render rating(person.player.score, person.player.count, m.match_rating_player())}
        {/if}
      </div>
    {/if}

    {#if person.commonSystems.length > 0 || commonChips.length > 0}
      <div class="relative mt-1.5 rounded-lg border-3 border-punk-ink bg-punk-paper px-3 pt-4 pb-3">
        <span
          class="absolute -top-3.5 left-2.5 -rotate-3 border-2 border-punk-ink bg-punk-pink px-2.5 font-comic text-lg leading-snug"
        >
          {m.match_common_title()}
        </span>
        <ul class="flex flex-wrap gap-2" aria-label={m.match_common_label()}>
          {#each person.commonSystems as system, i (system.slug)}
            <li
              class="inline-flex h-8 items-center gap-1.5 rounded-md bg-punk-ink px-3 text-sm font-extrabold whitespace-nowrap text-punk-yellow shadow-[3px_3px_0_var(--color-punk-pink)] {i %
                2 ===
              0
                ? '-rotate-2'
                : 'rotate-1'}"
            >
              <Icon name="check" size={16} />{system.name}
            </li>
          {/each}
          {#each commonChips as chip (chip.text)}
            <li
              class="inline-flex h-7.5 items-center gap-1.5 rounded-md border-2 border-punk-ink px-2.5 text-sm font-bold whitespace-nowrap"
            >
              <Icon name={chip.icon} size={16} />{chip.text}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
    <SuitBadge
      pole={corners[2].pole}
      percent={corners[2].percent}
      size={badge}
      corner="bottom-left"
    />
    <p class="min-w-0 flex-1 text-center text-xs leading-snug font-semibold">{extra}</p>
    <SuitBadge
      pole={corners[3].pole}
      percent={corners[3].percent}
      size={badge}
      corner="bottom-right"
    />
  </div>
</article>

{#snippet rating(score: number, count: number, what: string)}
  <span class="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
    <span
      class="inline-flex h-7 items-center gap-1 rounded-md border-2 border-punk-ink bg-punk-yellow px-2 font-comic text-lg shadow-[2px_2px_0_var(--color-punk-ink)]"
    >
      <Icon name="star" size={16} />{score.toLocaleString('pt-BR')}
    </span>
    {m.match_rating_count({ what, count })}
  </span>
{/snippet}

<style>
  /* The card is a sticker: a hard pink then ink shadow. */
  .punk-card {
    box-shadow:
      6px 6px 0 var(--color-punk-pink),
      10px 10px 0 var(--color-punk-ink);
  }
  /* Illustration geometry: halftone dots and sunburst rays over the seat colour, and a torn
     zigzag bottom edge (20 teeth). */
  .punk-hero {
    height: 44%;
    background:
      radial-gradient(rgb(26 11 46 / 0.18) 1.5px, transparent 2px) 0 0 / 10px 10px,
      repeating-conic-gradient(
        from 0deg at 50% 60%,
        rgb(255 248 236 / 0.45) 0deg 9deg,
        transparent 9deg 18deg
      ),
      var(--seat);
    clip-path: polygon(
      0% 100%,
      5% 93%,
      10% 100%,
      15% 93%,
      20% 100%,
      25% 93%,
      30% 100%,
      35% 93%,
      40% 100%,
      45% 93%,
      50% 100%,
      55% 93%,
      60% 100%,
      65% 93%,
      70% 100%,
      75% 93%,
      80% 100%,
      85% 93%,
      90% 100%,
      95% 93%,
      100% 100%,
      100% 0,
      0 0
    );
  }
  .punk-hero.punk-compact {
    height: 38%;
  }
  .punk-seat-1 {
    --seat: var(--color-success-500);
  }
  .punk-seat-2 {
    --seat: var(--color-tertiary-400);
  }
  .punk-seat-3 {
    --seat: var(--color-secondary-300);
  }
</style>
