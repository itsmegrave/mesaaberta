<script lang="ts">
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { copyText } from '#lib/clipboard.js';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import { page } from '$app/state';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import BadgeIcons from './components/ui/BadgeIcons.svelte';
  import BadgeStrip from './components/BadgeStrip.svelte';
  import ActionForm from '#lib/components/ActionForm.svelte';
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

<section class="pt-2 pb-4 md:pt-12">
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
              class="btn h-12 rounded-lg preset-filled-primary-500 px-5 font-semibold"
              >{m.public_profile_edit()}</a
            >
          {/if}
          <KebabMenu name={atHandle(profile.username)} items={menu} />
        </div>
      </div>
      <div class="mt-4 min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <h1
            class="text-4xl leading-none font-semibold tracking-tight wrap-break-word md:text-6xl"
          >
            <UserLink username={profile.username} />
          </h1>
          {#if !data.isOwner}
            <ActionForm action="?/message">
              <button
                type="submit"
                class="btn size-10 rounded-full preset-outlined-primary-500 p-0"
                aria-label={m.public_profile_message_to({ username: atHandle(profile.username) })}
                title={m.public_profile_message()}
              >
                <Icon name="game-icons:scroll-quill" size={20} />
              </button>
            </ActionForm>
          {/if}
        </div>
        {#if data.badges}<BadgeIcons badges={data.badges} anchor={!data.isOwner} />{/if}
        {#if profile.bio}
          <!-- Plain text in the person's own words: line breaks kept, nothing else. -->
          <p class="mt-4 max-w-prose wrap-break-word whitespace-pre-line">{profile.bio}</p>
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

      <div class="mt-8 grid gap-6 border-t border-surface-200-800 pt-6 lg:grid-cols-2">
        <div>
          <dl class="grid grid-cols-2 gap-4">
            {#each [{ label: m.public_profile_played(), value: profile.totals.played }, { label: m.public_profile_hosted(), value: profile.totals.hosted }] as stat (stat.label)}
              <div class="rounded-lg border border-surface-200-800 p-4">
                <dt class="flex items-center gap-2 text-sm font-semibold text-muted">
                  <Icon name="game-icons:meeple" size={18} class="shrink-0" />{stat.label}
                </dt>
                <dd class="mt-1 text-3xl font-semibold tabular-nums">
                  {number.format(stat.value)}
                </dd>
              </div>
            {/each}
          </dl>
          <p class="mt-3 max-w-prose text-sm text-muted">{m.public_profile_counts_hint()}</p>
        </div>
        <section aria-labelledby="gm-rating">
          <h2 id="gm-rating" class="text-lg font-semibold">{m.public_profile_rating()}</h2>
          <GmRating rating={profile.rating} class="mt-3 text-2xl" />
        </section>
      </div>
    </div>
  </header>

  {#if data.badges && data.isOwner}
    <BadgeStrip badges={data.badges} progress={data.badgeProgress ?? []} />
  {/if}

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
</section>
