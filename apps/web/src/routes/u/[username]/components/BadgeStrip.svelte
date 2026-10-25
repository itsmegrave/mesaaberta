<script lang="ts">
  import BadgeVisibility from './BadgeVisibility.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { BADGE_PRESENTATION, presentationOf } from '#lib/badges/presentation.js';
  import { withLook, type HeldBadge } from '#lib/badges/shown.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  type Progress = { badgeId: string; current: number; goal: number };
  // The owner's own view of their badges: every one earned with an eye to hide it from the profile,
  // and what is left to earn. Visitors see only the icons under the handle (`BadgeIcons`).
  let { badges, progress = [] }: { badges: HeldBadge[]; progress?: Progress[] } = $props();

  const since = new Intl.DateTimeFormat(getLocale(), {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const visible = $derived(withLook(badges));
  // The owner's "A conquistar": the next rung of each ladder and the single badges, then the ones
  // only the team gives (nothing to measure, so 0 of 1).
  const locked = $derived.by(() => {
    const have = new Set(badges.map((badge) => badge.badgeId));
    const measured = progress.flatMap((entry) => {
      const look = presentationOf(entry.badgeId);
      return look?.goal ? [{ ...entry, look }] : [];
    });
    const manual = Object.entries(BADGE_PRESENTATION)
      .filter(([id, look]) => look.manual && !have.has(id))
      .map(([id, look]) => ({ badgeId: id, current: 0, goal: 1, look }));
    return [...measured, ...manual];
  });

  const tile = 'flex items-start gap-4 rounded-lg border border-surface-200-800 bg-panel p-4';
</script>

{#if visible.length > 0 || locked.length > 0}
  <section id="conquistas" aria-labelledby="badges" class="mt-8">
    <div class="flex items-center gap-3">
      <h2 id="badges" class="text-2xl leading-tight font-semibold tracking-tight">
        {m.badges_title()}
      </h2>
      <span class="chip h-6 preset-tonal px-3 text-sm font-semibold tabular-nums">
        {visible.length}
      </span>
    </div>
    <p class="mt-2 max-w-prose text-sm text-muted">{m.badges_intro()}</p>

    <ul class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each visible as badge (badge.badgeId)}
        <li class="{tile} {badge.hidden ? 'border-dashed' : ''}">
          <span
            class="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-500 text-primary-contrast-500"
          >
            <Icon name={badge.look.icon} size={28} />
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{badge.look.name()}</p>
            {#if badge.look.ladder}
              <!-- Seats filled up to the rung reached, hollow for the rest; the name says the numeral too. -->
              <span class="mt-1 flex gap-1" aria-hidden="true">
                {#each [1, 2, 3] as seat (seat)}
                  <span
                    class="size-2 rounded-full border border-surface-500 {seat <= badge.look.tier
                      ? 'bg-primary-500'
                      : ''}"
                  ></span>
                {/each}
              </span>
            {/if}
            <p class="text-sm text-muted">{badge.look.description()}</p>
            <p class="mt-1 text-sm text-muted">
              {#if badge.hidden}
                {m.badges_hidden_note()}
              {:else if badge.backfilled}
                {m.badges_before_release()}
              {:else}
                {m.badges_earned_on({ date: since.format(new Date(badge.awardedAt)) })}
              {/if}
            </p>
          </div>
          <BadgeVisibility badgeId={badge.badgeId} hidden={badge.hidden} />
        </li>
      {/each}
    </ul>

    {#if locked.length > 0}
      <h3 class="mt-8 text-lg font-semibold">{m.badges_to_earn()}</h3>
      <ul class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each locked as badge (badge.badgeId)}
          <li class={tile}>
            <span
              class="relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-surface-500 bg-surface-200-800 text-muted"
            >
              <Icon name={badge.look.icon} size={28} />
              <span
                class="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-surface-50-950 text-muted"
              >
                <Icon name="lock" size={12} />
                <span class="sr-only">{m.badges_locked()}</span>
              </span>
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{badge.look.name()}</p>
              <p class="text-sm text-muted">{badge.look.goal?.()}</p>
              <!-- A native progress element: the CSP blocks inline style attributes, so no computed width. -->
              <progress
                class="mt-2 block h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary-500 [&::-webkit-progress-bar]:bg-surface-200-800 [&::-webkit-progress-value]:bg-primary-500"
                value={badge.current}
                max={badge.goal}
                aria-label={badge.look.name()}
              ></progress>
              <p class="mt-1 text-sm text-muted tabular-nums">
                {badge.look.progress?.({ current: badge.current })}
              </p>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
