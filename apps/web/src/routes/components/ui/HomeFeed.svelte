<script lang="ts">
  // De quem você segue: the last two weeks of what people you follow did in public.
  import { presentationOf } from '#lib/badges/presentation.js';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { routes } from '@mesaaberta/core/routes';
  import type { Home } from '@mesaaberta/core/server/reads/home';
  import { m } from '#lib/paraglide/messages.js';
  import { agoLabel } from '../home-format';

  let { feed, now }: { feed: Home['feed']; now: Date } = $props();

  const text = (item: Home['feed'][number]) => {
    const person = atHandle(item.username);
    if (item.kind === 'table') return m.home_feed_table({ person, table: item.title ?? '' });
    if (item.kind === 'seat') return m.home_feed_seat({ person, table: item.title ?? '' });
    const badge = presentationOf(item.badgeId ?? '')?.name();
    return badge ? m.home_feed_badge({ person, badge }) : m.home_feed_badge_unnamed({ person });
  };
</script>

<section
  aria-labelledby="home-feed"
  class="rounded-lg border border-surface-200-800 bg-panel p-4 md:p-5"
>
  <div class="flex items-baseline justify-between gap-3">
    <h2 id="home-feed" class="text-lg font-semibold md:text-xl">{m.home_feed_title()}</h2>
    <a href="/u/profile/edit/following" class="text-sm font-semibold">{m.home_feed_manage()}</a>
  </div>
  <ul class="mt-4 flex flex-col gap-4">
    {#each feed as item (`${item.kind}-${item.username}-${item.at.getTime()}`)}
      <li class="flex items-start gap-3">
        <MAAvatar name={item.username} size={32} />
        <span class="min-w-0 flex-1">
          {#if item.slug}
            <a href={routes.table(item.slug)} class="text-surface-950-50">{text(item)}</a>
          {:else}
            <a href={routes.profile(item.username)} class="text-surface-950-50">{text(item)}</a>
          {/if}
          <span class="block text-sm text-muted">{agoLabel(item.at, now)}</span>
        </span>
      </li>
    {/each}
  </ul>
</section>
