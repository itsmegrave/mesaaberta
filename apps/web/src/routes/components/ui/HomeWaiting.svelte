<script lang="ts">
  // Esperando você: what waits on the person, most urgent first, one button each.
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { routes } from '@mesaaberta/core/routes';
  import type { WaitingItem } from '@mesaaberta/core/server/reads/home';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import type { IconName } from '#lib/icons/names.js';
  import { m } from '#lib/paraglide/messages.js';
  import { shortWhen } from '../home-format';

  let { items, total }: { items: WaitingItem[]; total: number } = $props();

  const manage = (slug: string) => `${routes.table(slug)}/manage`;
  const line = (item: WaitingItem): { icon: IconName; text: string; cta: string; href: string } => {
    switch (item.kind) {
      case 'invitation':
        return {
          icon: 'mail',
          text: m.home_waiting_invitation({
            table: item.title,
            when: shortWhen(item.expiresAt, shownTimezone('America/Sao_Paulo')),
          }),
          cta: m.home_waiting_invitation_cta(),
          href: routes.invitation(item.id),
        };
      case 'confirm':
        return {
          icon: 'calendar',
          text: m.home_waiting_confirm({ table: item.title }),
          cta: m.home_waiting_confirm_cta(),
          href: manage(item.slug),
        };
      case 'requests':
        return {
          icon: 'game-icons:meeple',
          text: m.home_waiting_requests({ count: item.count, table: item.title }),
          cta: m.home_waiting_requests_cta(),
          href: manage(item.slug),
        };
      case 'rate_gm':
        return {
          icon: 'star',
          text: m.home_waiting_rate_gm({ table: item.title }),
          cta: m.home_waiting_rate_gm_cta(),
          href: routes.table(item.slug),
        };
      case 'rate_players':
        return {
          icon: 'star',
          text: m.home_waiting_rate_players({ count: item.count, table: item.title }),
          cta: m.home_waiting_rate_players_cta(),
          href: manage(item.slug),
        };
    }
  };
</script>

<section
  aria-labelledby="home-waiting"
  class="rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6"
>
  <div class="flex items-baseline justify-between gap-3">
    <h2 id="home-waiting" class="text-xl font-semibold">{m.home_waiting_title()}</h2>
    <span class="text-sm font-semibold text-muted">{m.home_waiting_count({ count: total })}</span>
  </div>
  <ul class="mt-4 flex flex-col divide-y divide-surface-200-800">
    {#each items as item, i (`${item.kind}-${item.slug}`)}
      {@const shown = line(item)}
      <!-- A phone shows the first two; "Ver todas" leads to the rest. -->
      <li
        class="flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between {i >=
        2
          ? 'hidden sm:flex'
          : 'flex'}"
      >
        <p class="flex items-start gap-3">
          <Icon name={shown.icon} size={20} class="mt-0.5 shrink-0 text-muted" />
          <span>{shown.text}</span>
        </p>
        <a href={shown.href} class="{buttonClass('secondary', 'sm')} shrink-0 font-semibold"
          >{shown.cta}</a
        >
      </li>
    {/each}
  </ul>
  {#if total > 2}
    <a href={routes.myTables} class="mt-4 inline-block font-semibold">{m.home_waiting_all()}</a>
  {/if}
</section>
