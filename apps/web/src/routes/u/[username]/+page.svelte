<script lang="ts">
  import TableRoleTag from '#lib/components/ui/TableRoleTag.svelte';
  import { copyText } from '#lib/clipboard.js';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import { page } from '$app/state';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import ScoreLine from '#lib/components/ui/ScoreLine.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import BadgeIcons from './components/ui/BadgeIcons.svelte';
  import ReviewCard from './components/ui/ReviewCard.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import BadgeVisibility from './components/BadgeVisibility.svelte';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import FollowButton from '#lib/components/FollowButton.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import TableCard from '#lib/components/ui/TableCard.svelte';
  import { pageHref } from '#lib/admin/page-href.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { networkIcons, networkLabels } from '#lib/profile/social-presentation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { data } = $props();
  const locale = getLocale();
  const profile = $derived(data.profile);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const path = $derived(`/u/${profile.username}`);
  const stats = $derived([
    {
      label: m.public_profile_played(),
      value: profile.totals.played,
      // Null while `use_player_ratings` has not reached this profile.
      rating: profile.participantRating,
      ratingLabel: m.participant_rating(),
      debut: m.participant_rating_new(),
    },
    {
      label: m.public_profile_hosted(),
      value: profile.totals.hosted,
      rating: profile.rating,
      ratingLabel: m.rating_gm_average(),
      debut: m.gm_rating_new(),
    },
  ]);

  // "Avaliações da mestragem": three at first; the button shows the rest in place.
  const REVIEWS_SHOWN = 3;
  let allReviews = $state(false);
  const reviews = $derived(allReviews ? data.reviews : data.reviews.slice(0, REVIEWS_SHOWN));
  // The folded header's line: the average once there are enough ratings, then how many are listed.
  const reviewsSummary = $derived(
    profile.rating?.score != null && !profile.rating.isNew
      ? m.public_profile_reviews_summary_score({
          score: new Intl.NumberFormat(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(profile.rating.score),
          count: data.reviews.length,
        })
      : m.public_profile_reviews_summary({ count: data.reviews.length }),
  );

  // One social link: the network's icon with the handle beside it.
  const chip =
    'inline-flex h-10 max-w-full items-center gap-2 rounded-lg border border-surface-200-800 px-3 text-sm font-semibold text-surface-950-50';

  function copyLink() {
    return copyText(data.canonical, m.toast_link_copied());
  }
  const menu = $derived.by(() => {
    const items: KebabItem[] = [
      { id: 'copy', label: m.menu_copy_link(), icon: 'copy', onselect: copyLink },
    ];
    if (data.isOwner) {
      items.push({
        id: 'visitor',
        label: m.menu_view_as_visitor(),
        icon: 'eye',
        href: `${path}?as=visitor`,
      });
    }
    return items;
  });
</script>

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs class="mb-6 md:mb-8" items={[{ label: atHandle(profile.username) }]} />

  {#if data.previewing}
    <p role="status" class="mb-4 flex flex-wrap items-center gap-3 font-semibold">
      {m.public_profile_previewing()}
      <a href={path} class="{buttonClass('secondary', 'sm')} font-semibold"
        >{m.public_profile_stop_previewing()}</a
      >
    </p>
  {/if}

  <header class="overflow-hidden rounded-lg border border-surface-200-800 bg-panel">
    <!-- The cover the person picked (4:1, cut that way when it was sent). Without one, the header is as before. -->
    {#if profile.bannerUrl}
      <img
        src={profile.bannerUrl}
        alt={m.public_profile_cover({ username: atHandle(profile.username) })}
        class="aspect-4/1 w-full object-cover"
      />
    {/if}
    <div class="px-6 pb-6 md:px-8 md:pb-8 {profile.bannerUrl ? '' : 'pt-6 md:pt-8'}">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <!-- With a cover, the photo sits over its bottom edge, in a ring of the card's colour. -->
        <span
          class="inline-flex rounded-full bg-panel p-1 {profile.bannerUrl
            ? '-mt-12 md:-mt-16'
            : ''}"
        >
          <MAAvatar
            src={profile.avatarUrl}
            name={profile.username}
            size={96}
            class="md:size-32 md:text-5xl"
          />
        </span>
        <div class="flex shrink-0 flex-wrap items-center gap-3 pt-3">
          {#if data.isOwner}
            <a
              href="/u/profile/edit"
              class="btn h-11 rounded-lg preset-filled-primary-500 px-5 font-semibold"
              >{m.public_profile_edit()}</a
            >
          {:else if data.follow}
            <FollowButton
              profileId={data.follow.profileId}
              username={profile.username}
              following={data.follow.following}
              signedIn={data.follow.signedIn}
            />
          {/if}
          <KebabMenu name={atHandle(profile.username)} items={menu} />
        </div>
      </div>
      <div class="mt-4 min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <h1
            class="text-3xl leading-none font-semibold tracking-tight wrap-break-word md:text-5xl"
          >
            <UserLink username={profile.username} />
          </h1>
          {#if !data.isOwner}
            <ActionForm action="?/message">
              {#snippet children(state)}
                <MAButton
                  type="submit"
                  size="custom"
                  controller={state}
                  class="btn size-10 rounded-full preset-outlined-primary-500 p-0"
                  aria-label={m.public_profile_message_to({ username: atHandle(profile.username) })}
                  title={m.public_profile_message()}
                >
                  {#if !state.delayed}<Icon name="game-icons:scroll-quill" size={20} />{/if}
                </MAButton>
              {/snippet}
            </ActionForm>
          {/if}
        </div>
        {#if data.followers !== null && data.followers !== undefined}
          <!-- Only the owner sees how many follow them. -->
          <a
            href="/u/profile/edit/following"
            class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-muted underline decoration-surface-200-800 underline-offset-3 hover:decoration-primary-500"
            >{m.follow_followers_count({ count: data.followers })}</a
          >
        {/if}
        {#if profile.name}
          <!-- The name, only when the person chose to show it under the @usuário. -->
          <p class="mt-2 text-xl wrap-break-word text-muted md:text-2xl">{profile.name}</p>
        {/if}
        {#if profile.tableRole}
          <!-- Joga, Mestra or both, while Quem mestra is on; who runs games is listed there. -->
          <p class="mt-3">
            <TableRoleTag
              tableRole={profile.tableRole}
              href={profile.tableRole === 'player' ? undefined : '/gamemasters'}
            />
          </p>
        {/if}
        {#if data.badges}
          <BadgeIcons badges={data.badges} owner={data.isOwner}>
            {#snippet action(badge)}
              {#if data.isOwner}<BadgeVisibility
                  badgeId={badge.badgeId}
                  hidden={badge.hidden}
                />{/if}
            {/snippet}
          </BadgeIcons>
        {/if}
        {#if profile.bio}
          <!-- Plain text in the person's own words: line breaks kept, nothing else. -->
          <p class="mt-4 max-w-prose wrap-break-word whitespace-pre-line">{profile.bio}</p>
        {/if}
        {#if profile.favoriteSystems?.length}
          <!-- Each leads to the open tables of that system. -->
          <ul aria-label={m.public_profile_favorite_systems()} class="mt-4 flex flex-wrap gap-2">
            {#each profile.favoriteSystems as system (system.slug)}
              <li>
                <a
                  href="/tables?system={encodeURIComponent(system.slug)}"
                  class="inline-flex h-9 items-center rounded-full bg-surface-wash px-4 text-sm font-semibold text-surface-950-50 no-underline hover:preset-tonal focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >{system.name}</a
                >
              </li>
            {/each}
          </ul>
        {/if}
        {#if profile.links.length > 0}
          <ul aria-label={m.public_profile_social_links()} class="mt-4 flex flex-wrap gap-2">
            {#each profile.links as link, index (`${link.network}-${index}`)}
              <li>
                {#if link.href}
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={m.public_profile_social_link({
                      network: networkLabels[link.network](),
                    })}
                    title={networkLabels[link.network]()}
                    class="{chip} hover:preset-tonal focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    <Icon name={networkIcons[link.network]} size={20} class="shrink-0" />
                    <span class="truncate">{link.text}</span>
                  </a>
                {:else}
                  <span title={networkLabels[link.network]()} class={chip}>
                    <Icon name={networkIcons[link.network]} size={20} class="shrink-0" />
                    <span class="sr-only">{networkLabels[link.network]()}:</span>
                    <span class="truncate">{link.text}</span>
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="mt-8 border-t border-surface-200-800 pt-6">
        <!-- Each score sits in its tile: as a participant under "Mesas jogadas", the GM's under
             "Mesas mestradas". -->
        <dl class="grid max-w-xl grid-cols-2 gap-4">
          {#each stats as stat (stat.label)}
            <div class="rounded-lg border border-surface-200-800 p-4">
              <dt class="flex items-center gap-2 text-sm font-semibold text-muted">
                <Icon name="game-icons:meeple" size={18} class="shrink-0" />{stat.label}
              </dt>
              <dd class="mt-1 text-3xl font-semibold tabular-nums">
                {number.format(stat.value)}
              </dd>
              {#if stat.rating}
                <dd class="mt-3 border-t border-surface-200-800 pt-3">
                  <ScoreLine rating={stat.rating} label={stat.ratingLabel} debut={stat.debut} />
                </dd>
              {/if}
            </div>
          {/each}
        </dl>
        <p class="mt-3 max-w-prose text-sm text-muted">{m.public_profile_counts_hint()}</p>
        {#if data.isOwner && profile.participantRating}
          <p class="mt-1 max-w-prose text-sm text-muted">{m.public_profile_scores_hint()}</p>
        {/if}
      </div>
    </div>
  </header>

  <section aria-labelledby="upcoming-tables" class="mt-8">
    <h2 id="upcoming-tables" class="text-2xl leading-tight font-semibold tracking-tight">
      {m.public_profile_upcoming()}
    </h2>
    {#if data.tables.length === 0}
      <p class="mt-4 text-muted">{m.public_profile_no_tables()}</p>
    {:else}
      <CardGrid class="mt-5">
        {#each data.tables as table (table.slug)}<li><TableCard {table} /></li>{/each}
      </CardGrid>
    {/if}
    <Pager
      compact
      class="mt-8"
      page={data.page}
      pages={data.pages}
      href={(number) => pageHref(path, page.url.searchParams, number)}
    />
  </section>

  {#if data.reviews.length > 0}
    <!-- On a phone the comments fold under their header, which keeps the average and the count. -->
    <MAAccordion collapse="phone" class="mt-12 border-y border-surface-200-800 md:border-0">
      <MAAccordionItem
        value="reviews"
        title={m.public_profile_reviews()}
        summary={reviewsSummary}
        titleClass="text-xl leading-tight font-semibold tracking-tight md:text-2xl"
        class="md:mt-5"
      >
        {#snippet aside()}
          {#if data.reviews.length > REVIEWS_SHOWN}
            <MAButton
              variant="secondary"
              aria-expanded={allReviews}
              aria-controls="gm-reviews-list"
              onclick={() => (allReviews = !allReviews)}
              >{allReviews
                ? m.public_profile_reviews_fewer()
                : m.public_profile_reviews_all({ count: data.reviews.length })}</MAButton
            >
          {/if}
        {/snippet}
        <ul
          id="gm-reviews-list"
          aria-label={m.public_profile_reviews_of({ username: atHandle(profile.username) })}
          class="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {#each reviews as review (`${review.username}-${review.table.slug}`)}
            <li><ReviewCard {review} /></li>
          {/each}
        </ul>
      </MAAccordionItem>
    </MAAccordion>
  {/if}
</section>
