<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Prose from '$lib/components/Prose.svelte';
  import type { SectionKind } from '$lib/changelog/entries';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();

  const locale = getLocale();
  const pagePath = (page: number) => (page === 1 ? '/changelog' : `/changelog?page=${page}`);

  // A release day, not an instant: read it in UTC so no timezone moves it to the day before.
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));

  const SECTION: Record<SectionKind, { label: () => string; chip: string }> = {
    added: { label: m.changelog_section_added, chip: 'preset-tonal-success' },
    changed: { label: m.changelog_section_changed, chip: 'preset-tonal-primary' },
    fixed: { label: m.changelog_section_fixed, chip: 'preset-tonal-warning' },
  };

  const pageLink =
    'btn h-12 rounded-lg border-2 border-surface-200-800 px-4 text-sm font-semibold hover:preset-tonal';
</script>

<svelte:head>
  <title>{m.changelog_title()} · Mesa Aberta</title>
  <meta name="description" content={m.changelog_description()} />
  {#if data.page > 1}
    <meta name="robots" content="noindex, follow" />
  {/if}
</svelte:head>

<article class="mx-auto max-w-prose pt-2 pb-8 md:pt-12 md:pb-14">
  <Breadcrumbs class="mb-8" items={[{ label: m.changelog_title() }]} />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {m.changelog_title()}
  </h1>
  <p class="mt-3 text-muted">{m.changelog_lede()}</p>

  {#if data.entries.length === 0}
    <p class="mt-10 text-lg" role="status">{m.changelog_empty()}</p>
  {:else}
    <ol class="mt-8 md:mt-10">
      {#each data.entries as entry (entry.slug)}
        <!-- Its own address (/changelog#slug): where the bell's announcement of it leads. -->
        <li
          id={entry.slug}
          class="scroll-mt-24 border-t border-surface-200-800 py-8 first:border-t-0 first:pt-0"
        >
          <p class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <time datetime={entry.date}>{dayLabel(entry.date)}</time>
            {#if entry.draft}
              <span class="badge preset-filled-warning-500 font-semibold"
                >{m.changelog_draft()}</span
              >
            {/if}
          </p>
          <h2 class="mt-2 text-2xl leading-tight font-semibold text-balance">
            {entry.title}
          </h2>

          {#if entry.summary}
            <Prose>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own Markdown from the repo, rendered at build time -->
              {@html entry.summary}
            </Prose>
          {/if}

          {#each entry.sections as section (section.kind)}
            <section class="mt-6">
              <h3>
                <span class="badge font-semibold {SECTION[section.kind].chip}">
                  {SECTION[section.kind].label()}
                </span>
              </h3>
              <Prose>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own Markdown from the repo, rendered at build time -->
                {@html section.html}
              </Prose>
            </section>
          {/each}
        </li>
      {/each}
    </ol>
  {/if}

  {#if data.pages > 1}
    <nav
      aria-label={m.changelog_pagination_label()}
      class="mt-4 flex items-center justify-between gap-3 border-t border-surface-200-800 pt-6"
    >
      {#if data.page > 1}
        <a href={localizedHref(pagePath(data.page - 1), locale)} rel="prev" class={pageLink}
          >← {m.changelog_newer()}</a
        >
      {:else}
        <span></span>
      {/if}
      <p class="text-sm text-muted">
        {m.changelog_page_status({ page: data.page, pages: data.pages })}
      </p>
      {#if data.page < data.pages}
        <a href={localizedHref(pagePath(data.page + 1), locale)} rel="next" class={pageLink}
          >{m.changelog_older()} →</a
        >
      {:else}
        <span></span>
      {/if}
    </nav>
  {/if}
</article>
