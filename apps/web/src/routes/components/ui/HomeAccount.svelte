<script lang="ts">
  // Sua conta: both scores, the newest public review, the latest badge and who follows you.
  // "Novas" are the rating notices not read yet; opening Início does not mark them read.
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { presentationOf } from '#lib/badges/presentation.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { routes } from '@mesaaberta/core/routes';
  import type { Home } from '@mesaaberta/core/server/reads/home';
  import { m } from '#lib/paraglide/messages.js';
  import { agoLabel } from '../home-format';

  let {
    account,
    following,
    username,
    now,
  }: {
    account: Home['account'];
    following: number | null;
    username: string | null;
    now: Date;
  } = $props();

  const badge = $derived(
    account.latestBadge ? presentationOf(account.latestBadge.badgeId)?.name() : null,
  );
  const review = $derived(account.newestReview);
</script>

<section
  aria-labelledby="home-account"
  class="flex flex-col gap-4 rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6"
>
  <div class="flex items-baseline justify-between gap-3">
    <h2 id="home-account" class="text-xl font-semibold">{m.home_account_title()}</h2>
    {#if username}
      <a href={routes.profile(username)} class="text-sm font-semibold">{m.home_account_profile()}</a
      >
    {/if}
  </div>

  <dl class="grid gap-3">
    <div>
      <dt class="text-sm font-semibold text-muted">{m.home_account_gm_score()}</dt>
      <dd class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <GmRating rating={account.gm} />
        {#if account.unreadRatings > 0}
          <a href={routes.notifications} class="text-sm font-semibold"
            >{m.home_account_unread({ count: account.unreadRatings })}</a
          >
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-sm font-semibold text-muted">{m.home_account_player_score()}</dt>
      <dd class="mt-1"><GmRating rating={account.player} /></dd>
    </div>
  </dl>

  {#if review}
    <figure class="rounded-lg bg-surface-wash p-4">
      <figcaption class="flex items-center gap-2 text-sm font-semibold">
        <MAAvatar src={review.avatarUrl} name={review.username} size={28} />
        {atHandle(review.username ?? '')}
      </figcaption>
      <blockquote class="mt-2">“{review.comment}”</blockquote>
      <p class="mt-2 text-sm text-muted">
        {m.home_account_review_meta({
          when: agoLabel(review.createdAt, now),
          table: review.tableTitle,
        })}
      </p>
    </figure>
  {/if}

  {#if badge}
    <p>{m.home_account_badge({ badge })}</p>
  {/if}

  {#if account.followers !== null && following !== null}
    <p class="text-sm text-muted">
      {m.follow_followers_count({ count: account.followers })}. {m.follow_following_count({
        count: following,
      })}.
    </p>
  {/if}
</section>
