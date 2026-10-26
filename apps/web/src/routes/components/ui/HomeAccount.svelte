<script lang="ts">
  // Sua conta: both scores, the newest public review, the latest badge and who follows you.
  // "Novas" are the rating notices not read yet; opening Início does not mark them read.
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import ScoreLine from '#lib/components/ui/ScoreLine.svelte';
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
  class="flex flex-col gap-3 rounded-lg border border-surface-200-800 bg-panel p-4 md:gap-4 md:p-5"
>
  <div class="flex items-center justify-between gap-3">
    <h2 id="home-account" class="text-lg font-semibold md:text-xl">{m.home_account_title()}</h2>
    {#if username}
      <a href={routes.profile(username)} class="{buttonClass('secondary', 'sm')} font-semibold"
        >{m.home_account_profile()}</a
      >
    {/if}
  </div>

  <!-- The two scores side by side, each on its own tile. -->
  <dl class="grid grid-cols-2 gap-2 md:gap-3">
    <div class="min-w-0 rounded-lg bg-surface-wash p-3 md:p-4">
      <dt class="text-sm font-semibold text-muted">{m.home_account_gm_score()}</dt>
      <dd class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ScoreLine
          rating={account.gm}
          label={m.rating_gm_average()}
          debut={m.gm_rating_new()}
          class="text-base text-surface-950-50"
        />
        {#if account.unreadRatings > 0}
          <a href={routes.notifications} class="text-sm font-semibold"
            >{m.home_account_unread({ count: account.unreadRatings })}</a
          >
        {/if}
      </dd>
    </div>
    <div class="min-w-0 rounded-lg bg-surface-wash p-3 md:p-4">
      <dt class="text-sm font-semibold text-muted">{m.home_account_player_score()}</dt>
      <dd class="mt-1">
        <ScoreLine
          rating={account.player}
          label={m.participant_rating()}
          debut={m.participant_rating_new()}
          class="text-base text-surface-950-50"
        />
      </dd>
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
