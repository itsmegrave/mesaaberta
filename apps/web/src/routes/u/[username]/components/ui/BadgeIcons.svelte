<script lang="ts">
  // The badges under the user handle: a row of medals, each opening its details in a popover. On a
  // desktop it opens on hover and keyboard focus; on a phone a tap opens it and its X closes it. Esc
  // or a tap outside closes it too, and only one is open at a time. The owner also sees the badges
  // they hid, as dashed medals, and `action` adds what they can do with each one.
  import type { Snippet } from 'svelte';
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import BadgeMedal from '#lib/components/ui/BadgeMedal.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { ownerBadges, publicBadges, type HeldBadge, type ShownBadge } from '#lib/badges/shown.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let {
    badges,
    owner = false,
    action,
  }: {
    badges: HeldBadge[];
    /** The owner's own profile: hidden badges stay in the row, for them only. */
    owner?: boolean;
    /** Drawn at the foot of the details, for the owner (hide or show the badge). */
    action?: Snippet<[ShownBadge]>;
  } = $props();

  const since = new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const shown = $derived(owner ? ownerBadges(badges) : publicBadges(badges));
  const TIERS = [1, 2, 3] as const;
  // The seat colours, one per rung.
  const seat = ['bg-success-500', 'bg-tertiary-400', 'bg-secondary-300'];

  let openId = $state<string | null>(null);
  // Hover opens and leaving closes, with a short grace so the pointer can cross into the details.
  let hovered: string | null = null;
  let leaving: ReturnType<typeof setTimeout> | undefined;
  const stay = () => clearTimeout(leaving);
  const hoverIn = (event: PointerEvent, id: string) => {
    if (event.pointerType !== 'mouse') return;
    stay();
    hovered = id;
    openId = id;
  };
  const hoverOut = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    stay();
    hovered = null;
    leaving = setTimeout(() => (openId = null), 150);
  };
  // A click on a medal the mouse already opened by hovering keeps it open, instead of toggling it
  // shut; a tap, Esc or a click outside still close it.
  let pressing: string | null = null;
  const change = (id: string, open: boolean) => {
    const clickedHovered = pressing === id && hovered === id;
    pressing = null;
    if (open) openId = id;
    else if (openId === id && !clickedHovered) openId = null;
  };
  const nameOf = (badge: ShownBadge) =>
    badge.hidden ? m.badges_hidden_name({ name: badge.look.name() }) : badge.look.name();
</script>

{#if shown.length > 0}
  <ul id="conquistas" aria-label={m.badges_title()} class="mt-4 flex flex-wrap gap-2">
    {#each shown as badge (badge.badgeId)}
      <li>
        <Popover
          open={openId === badge.badgeId}
          onOpenChange={(details) => change(badge.badgeId, details.open)}
          autoFocus={false}
          positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
        >
          <Popover.Trigger
            aria-label={nameOf(badge)}
            class="flex size-10 items-center justify-center rounded-full focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            onpointerenter={(event: PointerEvent) => hoverIn(event, badge.badgeId)}
            onpointerleave={hoverOut}
            onpointerdown={() => (pressing = badge.badgeId)}
            onfocus={(event: FocusEvent) => {
              if ((event.currentTarget as HTMLElement).matches(':focus-visible'))
                openId = badge.badgeId;
            }}
          >
            <BadgeMedal
              icon={badge.look.icon}
              mark={badge.look.mark}
              size={40}
              locked={badge.hidden}
            />
          </Popover.Trigger>
          {#if openId === badge.badgeId}
            <!-- Built only while open: a closed positioner would put an inline style on the page. -->
            <Portal>
              <Popover.Positioner class="z-50!">
                <!-- 350px on a phone (never wider than the screen less its gutters), 300px from md. -->
                <Popover.Content
                  aria-label={nameOf(badge)}
                  class="w-87.5 max-w-[calc(100vw-2rem)] card border border-surface-200-800 bg-surface-100-900 p-4 text-sm shadow-2xl md:w-75"
                  onpointerenter={stay}
                  onpointerleave={hoverOut}
                >
                  <div class="flex items-start gap-3">
                    <BadgeMedal
                      icon={badge.look.icon}
                      mark={badge.look.mark}
                      size={44}
                      locked={badge.hidden}
                    />
                    <div class="min-w-0 flex-1">
                      <p class="font-semibold">{badge.look.name()}</p>
                      {#if badge.look.ladder}
                        <p class="mt-1 flex items-center gap-2 text-muted">
                          <span class="flex gap-1" aria-hidden="true">
                            {#each TIERS as tier (tier)}
                              <span
                                class="size-2 rounded-full {tier <= badge.look.tier
                                  ? seat[tier - 1]
                                  : 'border border-surface-600-400'}"
                              ></span>
                            {/each}
                          </span>
                          {m.badges_tier({ tier: badge.look.tier, total: TIERS.length })}
                        </p>
                      {/if}
                    </div>
                    <Popover.CloseTrigger
                      aria-label={m.badges_details_close()}
                      class="{buttonClass(
                        'ghost',
                        'custom',
                      )} -m-2 flex size-10 items-center justify-center rounded-lg hover:preset-tonal"
                    >
                      <Icon name="xmark" size={20} />
                    </Popover.CloseTrigger>
                  </div>
                  <p class="mt-3 text-muted">{badge.look.description()}</p>
                  <p class="mt-1 text-muted">
                    {badge.backfilled
                      ? m.badges_before_release()
                      : m.badges_earned_on({ date: since.format(new Date(badge.awardedAt)) })}
                  </p>
                  {#if badge.hidden}
                    <p class="mt-1 text-muted">{m.badges_hidden_only_you()}</p>
                  {/if}
                  {#if action}<div class="mt-3">{@render action(badge)}</div>{/if}
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          {/if}
        </Popover>
      </li>
    {/each}
  </ul>
{/if}
