<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import { copyText } from '#lib/clipboard.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { yearReviewShareSchema } from '@mesaaberta/core/profile/year-review-share';
  import { reviewTiles } from './review-tiles';

  let { data } = $props();
  const review = $derived(data.review);
  const year = $derived(String(review.year));
  const who = $derived(data.person.name ?? atHandle(data.person.username));
  const tiles = $derived(reviewTiles(review));
  const empty = $derived(review.played === 0 && review.ran === 0);
  const month = $derived(
    review.busiestMonth
      ? new Intl.DateTimeFormat(getLocale(), { month: 'long', timeZone: 'UTC' }).format(
          new Date(Date.UTC(review.year, review.busiestMonth - 1, 15)),
        )
      : null,
  );
</script>

<svelte:head>
  <title>{m.year_review_title({ year })} · {who} · Mesa Aberta</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="pt-2 pb-8 md:pt-8">
  <Breadcrumbs
    class="mb-6 md:mb-8"
    items={[
      { label: atHandle(data.person.username), href: `/u/${data.person.username}` },
      { label: m.year_review_title({ year }) },
    ]}
  />

  <header
    class="flex flex-col items-start gap-4 rounded-lg border border-surface-200-800 bg-panel p-6 md:flex-row md:items-center md:p-8"
  >
    <MAAvatar src={data.person.avatarUrl} name={data.person.username} size={80} />
    <div class="min-w-0">
      <p class="text-sm font-semibold tracking-wide text-muted uppercase">
        {m.year_review_title({ year })}
      </p>
      <h1
        class="mt-1 text-3xl leading-tight font-semibold tracking-tight wrap-break-word md:text-4xl"
      >
        {empty ? m.year_review_heading_empty({ who }) : m.year_review_heading({ who, year })}
      </h1>
    </div>
  </header>

  {#if empty}
    <p class="mt-6 text-muted">
      {data.own ? m.year_review_empty_own() : m.year_review_empty()}
      {#if data.own}<a href="/tables" class="font-semibold text-link underline underline-offset-4"
          >{m.year_review_find_table()}</a
        >{/if}
    </p>
  {:else}
    <ul class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {#each tiles as tile (tile.key)}
        <li class="rounded-lg border border-surface-200-800 bg-panel p-4 md:p-5">
          <p class="text-4xl font-semibold tracking-tight md:text-5xl">{tile.value}</p>
          <p class="mt-1 text-sm font-semibold text-muted">{tile.label}</p>
        </li>
      {/each}
    </ul>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      {#if review.systems.length > 0}
        <div class="rounded-lg border border-surface-200-800 bg-panel p-5">
          <h2 class="text-lg font-semibold">{m.year_review_systems()}</h2>
          <ol class="mt-3 grid gap-2">
            {#each review.systems as system, index (system.slug)}
              <li class="flex items-center justify-between gap-3">
                <a href="/s/{system.slug}" class="font-semibold underline-offset-4 hover:underline"
                  >{index + 1}. {system.name}</a
                >
                <span class="text-sm text-muted"
                  >{m.year_review_tables({ count: system.tables })}</span
                >
              </li>
            {/each}
          </ol>
        </div>
      {/if}
      <div class="grid content-start gap-3 rounded-lg border border-surface-200-800 bg-panel p-5">
        <h2 class="text-lg font-semibold">{m.year_review_highlights()}</h2>
        {#if month}
          <p class="flex items-center gap-2">
            <Icon
              name="game-icons:dice-twenty-faces-twenty"
              size={20}
              class="shrink-0 text-muted"
            />
            {m.year_review_busiest_month({ month })}
          </p>
        {/if}
        {#if review.topGm}
          <p class="flex items-center gap-2">
            <Icon name="game-icons:pointy-hat" size={20} class="shrink-0 text-muted" />
            <span>
              {m.year_review_top_gm_before()}
              <a
                href="/u/{review.topGm.username}"
                class="font-semibold underline underline-offset-4"
                >{atHandle(review.topGm.username)}</a
              >
              {m.year_review_top_gm_after({ count: review.topGm.tables })}
            </span>
          </p>
        {/if}
        {#if review.badges > 0}
          <p class="flex items-center gap-2">
            <Icon name="game-icons:podium" size={20} class="shrink-0 text-muted" />
            {m.year_review_badges({ count: review.badges })}
          </p>
        {/if}
      </div>
    </div>
  {/if}

  {#if data.own}
    <div
      class="mt-6 flex flex-col gap-3 rounded-lg border border-surface-200-800 bg-panel p-5 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h2 class="text-lg font-semibold">
          {data.shared ? m.year_review_public() : m.year_review_private()}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {data.shared ? m.year_review_public_hint() : m.year_review_private_hint()}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        {#if data.shared}
          <MAButton variant="secondary" onclick={() => copyText(data.link, m.toast_link_copied())}>
            <Icon name="copy" size={18} />{m.menu_copy_link()}
          </MAButton>
        {/if}
        <PostButton
          action="?/share"
          fields={{ shared: data.shared ? 'false' : 'true' }}
          schema={yearReviewShareSchema}
          errorMessage={m.form_error_invalid}
          success={data.shared ? m.year_review_made_private() : m.year_review_made_public()}
          variant={data.shared ? 'secondary' : 'primary'}
          size="md"
          >{data.shared ? m.year_review_make_private() : m.year_review_make_public()}</PostButton
        >
      </div>
    </div>
  {/if}
</section>
