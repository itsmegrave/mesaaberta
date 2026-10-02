<script lang="ts">
  import UserLink from '$lib/components/UserLink.svelte';
  import { page } from '$app/state';
  import Avatar from '$lib/components/Avatar.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import TableCard from '$lib/components/TableCard.svelte';
  import { pageHref } from '$lib/admin/page-href';
  import { localizedHref } from '$lib/i18n/locales';
  import { atHandle } from '$lib/profile/handle';
  import { networkIcons, networkLabels } from '$lib/profile/social-presentation';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();
  const locale = getLocale();
  const profile = $derived(data.profile);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const path = $derived(`/${profile.username}`);
</script>

<svelte:head>
  <title>{atHandle(profile.username)} · Mesa Aberta</title>
  <meta
    name="description"
    content={m.public_profile_description({ username: atHandle(profile.username) })}
  />
  <link rel="canonical" href={data.canonical} />
  <meta property="og:title" content={`${atHandle(profile.username)} · Mesa Aberta`} />
  <meta
    property="og:description"
    content={m.public_profile_description({ username: atHandle(profile.username) })}
  />
  <meta property="og:url" content={data.canonical} />
  <meta property="og:type" content="profile" />
  {#if profile.avatarUrl}<meta property="og:image" content={profile.avatarUrl} />{/if}
</svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs class="mb-8" items={[{ label: atHandle(profile.username) }]} />
  <a
    href={localizedHref('/tables', locale)}
    class="mb-6 inline-flex h-12 items-center gap-2 link-underline md:hidden"
  >
    <Icon name="arrow-left" />{m.table_back()}
  </a>

  <header class="rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8">
    <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div class="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar src={profile.avatarUrl} name={profile.username} size={80} />
        <div class="min-w-0">
          <h1
            class="text-4xl leading-none font-semibold tracking-tight wrap-break-word md:text-6xl"
          >
            <UserLink username={profile.username} />
          </h1>
          {#if profile.links.length > 0}
            <ul aria-label={m.public_profile_social_links()} class="mt-4 flex flex-wrap gap-2">
              {#each profile.links as link, index (`${link.network}-${index}`)}
                <li>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={m.public_profile_social_link({
                      network: networkLabels[link.network](),
                    })}
                    title={networkLabels[link.network]()}
                    class="btn size-12 rounded-lg border border-surface-200-800 p-0 text-surface-950-50 hover:preset-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    <Icon name={networkIcons[link.network]} size={24} />
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
      {#if data.isOwner}
        <a
          href={localizedHref('/account/profile', locale)}
          class="btn h-12 shrink-0 rounded-lg preset-outlined-primary-500 px-5 font-semibold"
          >{m.public_profile_edit()}</a
        >
      {/if}
    </div>

    <div class="mt-8 grid gap-6 border-t border-surface-200-800 pt-6 lg:grid-cols-2">
      <div>
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-sm font-semibold text-muted">{m.public_profile_played()}</dt>
            <dd class="mt-1 text-3xl font-semibold tabular-nums">
              {number.format(profile.totals.played)}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-semibold text-muted">{m.public_profile_hosted()}</dt>
            <dd class="mt-1 text-3xl font-semibold tabular-nums">
              {number.format(profile.totals.hosted)}
            </dd>
          </div>
        </dl>
        <p class="mt-3 max-w-prose text-sm text-muted">{m.public_profile_counts_hint()}</p>
      </div>
      <section aria-labelledby="gm-rating">
        <h2 id="gm-rating" class="text-lg font-semibold">{m.public_profile_rating()}</h2>
        {#if profile.rating.average !== null && profile.rating.count > 0}
          <p class="mt-3 flex flex-wrap items-center gap-2">
            <Icon name="star" class="text-lamp" size={24} />
            <strong class="text-3xl tabular-nums"
              >{number.format(profile.rating.average)}<span class="text-lg text-muted">
                / 5</span
              ></strong
            >
            <span class="text-sm text-muted">{m.rating_count({ count: profile.rating.count })}</span
            >
          </p>
        {:else}
          <p class="mt-3 text-muted">{m.public_profile_unrated()}</p>
        {/if}
      </section>
    </div>
  </header>

  <section aria-labelledby="upcoming-tables" class="mt-8">
    <h2 id="upcoming-tables" class="text-2xl leading-tight font-semibold tracking-tight">
      {m.public_profile_upcoming()}
    </h2>
    {#if data.tables.length === 0}
      <p class="mt-4 text-muted">{m.public_profile_no_tables()}</p>
    {:else}
      <ul class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {#each data.tables as table (table.slug)}<li><TableCard {table} /></li>{/each}
      </ul>
    {/if}
    {#if data.pages > 1}
      <nav
        aria-label={m.admin_pagination()}
        class="mt-8 flex flex-wrap items-center justify-center gap-3"
      >
        {#if data.page > 1}
          <a
            class="btn size-12 rounded-lg border border-surface-200-800 p-0 text-surface-950-50"
            href={pageHref(path, page.url.searchParams, data.page - 1, locale)}
            aria-label={m.admin_profile_previous()}><Icon name="chevron-left" /></a
          >
        {/if}
        <span class="font-semibold"
          >{m.admin_profile_page({ page: data.page, pages: data.pages })}</span
        >
        {#if data.page < data.pages}
          <a
            class="btn size-12 rounded-lg border border-surface-200-800 p-0 text-surface-950-50"
            href={pageHref(path, page.url.searchParams, data.page + 1, locale)}
            aria-label={m.admin_profile_next()}><Icon name="chevron-right" /></a
          >
        {/if}
      </nav>
    {/if}
  </section>
</section>
