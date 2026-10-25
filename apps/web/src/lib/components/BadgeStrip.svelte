<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import { presentationOf } from '#lib/badges/presentation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  type Held = { badgeId: string; awardedAt: Date | string; hidden: boolean; backfilled: boolean };
  let { badges, isOwner = false }: { badges: Held[]; isOwner?: boolean } = $props();

  const date = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeZone: 'UTC' });
  // What a visitor sees: the ones the owner hid are theirs alone, and a badge without artwork waits for it.
  const shown = $derived(
    badges.flatMap((badge) => {
      const look = presentationOf(badge.badgeId);
      return look && (isOwner || !badge.hidden) ? [{ ...badge, look }] : [];
    }),
  );
  // Tier 0 is a single-level badge; a ladder's tiers get stronger colours.
  const tile = [
    'preset-tonal-surface',
    'preset-tonal-surface',
    'preset-tonal-primary',
    'preset-filled-primary-500',
  ];
</script>

{#if shown.length > 0}
  <section aria-labelledby="badges" class="mt-8">
    <h2 id="badges" class="text-2xl leading-tight font-semibold tracking-tight">
      {m.badges_title()}
    </h2>
    <ul class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each shown as badge (badge.badgeId)}
        <li class="flex items-start gap-4 rounded-lg border border-surface-200-800 bg-panel p-4">
          <span
            class="flex size-12 shrink-0 items-center justify-center rounded-lg {tile[
              badge.look.tier
            ]}"
          >
            <Icon name={badge.look.icon} size={28} />
          </span>
          <div class="min-w-0">
            <p class="font-semibold">{badge.look.name()}</p>
            <p class="text-sm text-muted">{badge.look.description()}</p>
            <p class="mt-1 text-sm text-muted">
              {badge.backfilled
                ? m.badges_before_release()
                : m.badges_earned_on({ date: date.format(new Date(badge.awardedAt)) })}
            </p>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}
