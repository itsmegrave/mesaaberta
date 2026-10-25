<script lang="ts">
  // The badges under the user handle: only the icons. Hover or focus shows the details on a desktop;
  // a tap opens them on a phone, and Esc closes them.
  import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';
  import Icon from '#lib/components/Icon.svelte';
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
        <Tooltip
          open={openId === badge.badgeId}
          onOpenChange={(details) => (openId = details.open ? badge.badgeId : null)}
          closeOnClick={false}
          positioning={{ placement: 'bottom' }}
        >
          <Tooltip.Trigger
            type="button"
            aria-label={badge.look.name()}
            onclick={() => (openId = openId === badge.badgeId ? null : badge.badgeId)}
            class="flex size-10 items-center justify-center rounded-full bg-primary-500 text-primary-contrast-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 sm:size-9"
          >
            <Icon name={badge.look.icon} size={22} />
          </Tooltip.Trigger>
          {#if openId === badge.badgeId}
            <Portal>
              <Tooltip.Positioner class="z-50!">
                <Tooltip.Content
                  class="max-w-72 card border border-surface-200-800 bg-surface-100-900 p-3 text-sm shadow-2xl"
                >
                  <p class="font-semibold">{badge.look.name()}</p>
                  <p class="text-muted">{badge.look.description()}</p>
                  <p class="mt-1 text-muted">
                    {badge.backfilled
                      ? m.badges_before_release()
                      : m.badges_earned_on({ date: since.format(new Date(badge.awardedAt)) })}
                  </p>
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          {/if}
        </Tooltip>
      </li>
    {/each}
  </ul>
{/if}
