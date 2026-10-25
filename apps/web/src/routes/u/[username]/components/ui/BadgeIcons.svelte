<script lang="ts">
  // The badges under the user handle: only the icons. Hover or focus shows the details on a desktop;
  // a tap opens them on a phone, and Esc closes them.
  import BadgeMedal from '#lib/components/ui/BadgeMedal.svelte';
  import Tip from '#lib/components/ui/Tip.svelte';
  import { publicBadges, type HeldBadge } from '#lib/badges/shown.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  // `anchor`: the list is where /u/<name>#conquistas lands (the owner's own section is, for them).
  let { badges, anchor = true }: { badges: HeldBadge[]; anchor?: boolean } = $props();

  const since = new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const shown = $derived(publicBadges(badges));
  let openId = $state<string | null>(null);
</script>

{#if shown.length > 0}
  <ul
    id={anchor ? 'conquistas' : undefined}
    aria-label={m.badges_title()}
    class="mt-4 flex flex-wrap gap-2"
  >
    {#each shown as badge (badge.badgeId)}
      <li>
        <Tip
          bind:open={
            () => openId === badge.badgeId, (open) => (openId = open ? badge.badgeId : null)
          }
          placement="bottom"
          label={badge.look.name()}
          triggerClass="flex size-10 items-center justify-center rounded-full focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {#snippet trigger()}<BadgeMedal
              icon={badge.look.icon}
              mark={badge.look.mark}
              size={40}
            />{/snippet}
          <p class="font-semibold">{badge.look.name()}</p>
          <p class="text-muted">{badge.look.description()}</p>
          <p class="mt-1 text-muted">
            {badge.backfilled
              ? m.badges_before_release()
              : m.badges_earned_on({ date: since.format(new Date(badge.awardedAt)) })}
          </p>
        </Tip>
      </li>
    {/each}
  </ul>
{/if}
