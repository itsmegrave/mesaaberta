<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { asset } from '$app/paths';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import TableIllustration from '#lib/components/ui/TableIllustration.svelte';
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import { kinds, releaseHref, type ChangeKind } from '#lib/changelog.js';
  import { copyText } from '#lib/clipboard.js';
  import { toast } from '#lib/toaster.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data } = $props();
  let slide = $state(0);
  let hydrated = $state(false);
  // On a phone only the newest month starts open, and the month a link points at (#2026-10-25). A
  // new page or filter starts again from its newest month.
  let openMonths = $derived(data.entries[0] ? [data.entries[0].date.slice(0, 7)] : []);
  const openLinkedDay = async () => {
    const day = decodeURIComponent(location.hash.slice(1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || openMonths.includes(day.slice(0, 7))) return;
    openMonths = [...openMonths, day.slice(0, 7)];
    await tick();
    document.getElementById(day)?.scrollIntoView();
  };
  onMount(() => {
    hydrated = true;
    void openLinkedDay();
  });
  const highlight = $derived(data.highlights[slide]);
  const preview = $derived(highlight.preview);
  const slideCount = $derived(
    m.changelog_slide_count({ current: slide + 1, total: data.highlights.length }),
  );
  const filters = [
    { kind: null, label: m.changelog_all, count: 'all' },
    { kind: 'new', label: m.changelog_new, count: 'new' },
    { kind: 'improved', label: m.changelog_improvements, count: 'improved' },
    { kind: 'fixed', label: m.changelog_fixes, count: 'fixed' },
  ] as const;
  const hints: Record<ChangeKind, () => string> = {
    new: m.changelog_new_hint,
    improved: m.changelog_improved_hint,
    fixed: m.changelog_fixed_hint,
  };
  const locale = getLocale();
  const date = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${value}T12:00:00Z`),
    );
  const day = (value: string) => date(value, { day: 'numeric', month: 'long', year: 'numeric' });
  const capitalized = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
  // The date box's short words ("DOM", "OUT"), without the abbreviation's dot.
  const short = (value: string, part: 'weekday' | 'month') =>
    date(value, { [part]: 'short' }).replace('.', '');
  const href = (kind: ChangeKind | null, page = 1): `/changelog${string}` => {
    const params = new SvelteURLSearchParams();
    if (kind) params.set('tipo', kind);
    if (page > 1) params.set('page', String(page));
    return `/changelog${params.size ? `?${params}` : ''}`;
  };
  // Release days by month ("2026-10"), in the page's order.
  const months = $derived(
    [...new Set(data.entries.map((entry) => entry.date.slice(0, 7)))].map((month) => ({
      month,
      entries: data.entries.filter((entry) => entry.date.startsWith(month)),
    })),
  );
  const move = (direction: number) => {
    slide = (slide + direction + data.highlights.length) % data.highlights.length;
  };
  async function copy(value: string) {
    const link = new URL(releaseHref(value), window.location.origin).href;
    if (!(await copyText(link, m.changelog_copied({ date: day(value) }))))
      toast.error(m.changelog_copy_failed());
  }
  const round = 'flex size-11 shrink-0 items-center justify-center rounded-full bg-panel';
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- release links and reviewed content use canonical paths, including their query and fragment. -->

{#snippet controls()}
  <div
    class="mt-3 flex items-center justify-center gap-3 md:col-start-2 md:row-start-1 md:mt-0 md:justify-self-end"
  >
    <MAButton
      disabled={!hydrated}
      variant="secondary"
      size="custom"
      class={round}
      aria-label={m.changelog_previous()}
      onclick={() => move(-1)}><Icon name="chevron-left" size={20} /></MAButton
    >
    <div class="flex items-center">
      {#each data.highlights as item, index (item.date)}
        <MAButton
          disabled={!hydrated}
          size="custom"
          class="flex h-11 w-7 items-center justify-center"
          aria-label={m.changelog_slide({ number: index + 1, title: item.title })}
          aria-pressed={slide === index}
          onclick={() => {
            slide = index;
          }}
        >
          <span
            aria-hidden="true"
            class="block h-2 rounded-full {slide === index
              ? 'w-5 bg-surface-950-50'
              : 'w-2 bg-surface-300-700'}"
          ></span>
        </MAButton>
      {/each}
    </div>
    <MAButton
      disabled={!hydrated}
      variant="secondary"
      size="custom"
      class={round}
      aria-label={m.changelog_next()}
      onclick={() => move(1)}><Icon name="chevron-right" size={20} /></MAButton
    >
    <span aria-hidden="true" class="ml-1 text-sm font-semibold text-muted tabular-nums"
      >{slideCount}</span
    >
  </div>
{/snippet}

<div class="mx-auto max-w-7xl py-6 md:py-12">
  <Breadcrumbs class="mb-2 md:mb-10" items={[{ label: m.changelog_title() }]} />
  <header>
    <h1 class="text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl">
      {m.changelog_title()}
    </h1>
    <p class="mt-3 max-w-2xl leading-relaxed text-muted md:text-lg">{m.changelog_lede()}</p>
  </header>

  <section
    class="mt-6 md:mt-10 md:grid md:grid-cols-2"
    aria-labelledby="highlights-title"
    aria-roledescription="carrossel"
  >
    <h2
      id="highlights-title"
      class="text-xl font-semibold tracking-tight md:row-start-1 md:self-center md:text-2xl"
    >
      {m.changelog_highlights()}
    </h2>
    <div
      role="group"
      aria-roledescription="slide"
      aria-label="{slideCount}: {highlight.title}"
      aria-live="polite"
      class="mt-3 grid overflow-hidden rounded-lg border border-surface-200-800 bg-panel md:col-span-2 md:row-start-2 md:mt-4 md:grid-cols-5"
    >
      <div
        class="flex h-45 items-center justify-center border-b border-surface-200-800 bg-surface-wash p-4 md:col-span-3 md:h-90 md:border-r md:border-b-0 md:p-6"
      >
        {#if preview}
          <img
            src={asset(`changelog/${preview}-light.jpg`)}
            alt={m.changelog_preview({ title: highlight.changes[0].title })}
            width={576}
            height={preview === 'chat' ? 186 : 300}
            class="size-full rounded-lg object-contain dark:hidden"
          />
          <img
            src={asset(`changelog/${preview}-dark.jpg`)}
            alt={m.changelog_preview({ title: highlight.changes[0].title })}
            width={576}
            height={preview === 'chat' ? 186 : 300}
            class="hidden size-full rounded-lg object-contain dark:block"
          />
        {:else}
          <!-- Square and as tall as the panel: the drawing takes its width, so a wider box would
               draw it taller than the phone's 180px panel, over the text below. -->
          <div class="aspect-square h-full"><TableIllustration /></div>
        {/if}
      </div>
      <div class="flex flex-col justify-center gap-1 px-4 pt-4 pb-2 md:col-span-2 md:gap-2 md:p-8">
        <time class="text-sm font-semibold text-muted" datetime={highlight.date}
          >{day(highlight.date)}</time
        >
        <h3 class="text-xl leading-tight font-semibold tracking-tight text-balance md:text-3xl">
          {highlight.title}
        </h3>
        <p class="leading-relaxed text-muted">{highlight.summary}</p>
        <a
          class="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-link underline underline-offset-4"
          href={releaseHref(highlight.date)}
          >{m.changelog_read()} <Icon name="arrow-right" size={16} /></a
        >
      </div>
    </div>
    <!-- After the slide on phones; on wider screens the grid moves it beside the heading. -->
    {@render controls()}
  </section>

  <div class="mt-5 flex flex-col gap-6 md:mt-12 lg:flex-row lg:items-start lg:gap-16">
    <div class="flex min-w-0 flex-1 flex-col gap-6 md:gap-8">
      <nav
        class="grid grid-cols-4 gap-0.5 rounded-full bg-surface-wash p-1 md:flex md:gap-1 md:self-start"
        aria-label={m.changelog_filter()}
      >
        {#each filters as filter (filter.count)}
          <a
            href={href(filter.kind)}
            aria-current={data.kind === filter.kind ? 'true' : undefined}
            class="flex h-12 flex-col items-center justify-center rounded-full px-1 text-sm leading-4 font-semibold md:h-11 md:flex-row md:gap-2 md:px-4 {data.kind ===
            filter.kind
              ? 'preset-filled-primary-500'
              : 'hover:bg-surface-wash'}"
          >
            {filter.label()}
            <span class="text-xs tabular-nums {data.kind === filter.kind ? '' : 'text-muted'}"
              >{data.counts[filter.count]}</span
            >
          </a>
        {/each}
      </nav>
      {#if !data.entries.length}<p role="status">{m.changelog_empty()}</p>{/if}
      <MAAccordion collapse="phone" bind:value={openMonths}>
        {#each months as group (group.month)}
          <MAAccordionItem
            value={group.month}
            title={capitalized(date(`${group.month}-01`, { month: 'long', year: 'numeric' }))}
            summary={m.changelog_month_summary({ count: group.entries.length })}
            titleClass="text-2xl font-semibold tracking-tight md:text-3xl"
            class="md:mt-8"
          >
            <ol class="flex flex-col gap-4 md:gap-0">
              {#each group.entries as entry, index (entry.date)}
                <li class="flex gap-6">
                  <div
                    class="hidden w-18 shrink-0 flex-col items-center md:flex"
                    aria-hidden="true"
                  >
                    {@render dateBox(entry.date, 'w-18 bg-panel pt-2 pb-2.5 text-3xl')}
                    {#if index < group.entries.length - 1}<span
                        class="mt-2 w-0.5 flex-1 bg-surface-200-800"
                      ></span>{/if}
                  </div>
                  <article
                    id={entry.date}
                    aria-labelledby="{entry.date}-title"
                    class="min-w-0 flex-1 scroll-mt-4 rounded-lg border border-surface-200-800 bg-panel px-4 py-5 md:mb-8 md:scroll-mt-6 md:p-6"
                  >
                    <div class="flex items-start gap-3.5 md:items-center md:justify-between">
                      <div class="md:hidden" aria-hidden="true">
                        {@render dateBox(entry.date, 'w-14 bg-surface-50-950 pt-1.5 pb-2 text-2xl')}
                      </div>
                      <div class="flex min-w-0 flex-col md:contents">
                        {#if entry.date === data.highlights[0].date}<span
                            class="mb-1.5 inline-flex h-6 items-center self-start rounded-full bg-surface-wash px-2.5 text-xs font-semibold md:hidden"
                            >{m.changelog_latest()}</span
                          >{/if}
                        <h3
                          id="{entry.date}-title"
                          class="text-xl leading-tight font-semibold tracking-tight md:hidden"
                        >
                          {entry.title}
                        </h3>
                        <a
                          href={releaseHref(entry.date)}
                          class="mt-1 text-sm font-semibold text-muted hover:underline md:mt-0"
                          ><time datetime={entry.date}
                            >{capitalized(
                              date(entry.date, {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              }),
                            )}</time
                          >
                          · {m.changelog_count({ count: entry.changes.length })}</a
                        >
                      </div>
                      <MAButton
                        disabled={!hydrated}
                        size="custom"
                        class="-mt-1.5 -mr-2 ml-auto inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted md:-my-2 md:ml-0 md:w-auto md:px-3"
                        aria-label={m.changelog_copy({ date: day(entry.date) })}
                        title={m.changelog_copy_label()}
                        onclick={() => copy(entry.date)}
                        ><Icon name="copy" size={16} /><span class="hidden md:inline"
                          >{m.changelog_copy_label()}</span
                        ></MAButton
                      >
                    </div>
                    <div class="mt-2 hidden flex-wrap items-center gap-3 md:flex">
                      <h3 class="text-2xl leading-tight font-semibold tracking-tight">
                        {entry.title}
                      </h3>
                      {#if entry.date === data.highlights[0].date}<span
                          class="inline-flex h-6 items-center rounded-full bg-surface-wash px-2.5 text-xs font-semibold"
                          >{m.changelog_latest()}</span
                        >{/if}
                    </div>
                    <p class="mt-2 hidden leading-relaxed text-muted md:block">{entry.summary}</p>
                    <ul class="mt-4 border-t border-surface-200-800 md:mt-5">
                      {#each entry.changes as change (change.title)}
                        <li class="border-b border-surface-200-800 py-3 md:flex md:gap-4 md:py-3.5">
                          <div class="md:flex md:h-6.5 md:w-28 md:shrink-0 md:items-center">
                            <StatusBadge
                              status={`changelog:${change.kind}`}
                              class="h-auto border-0 bg-transparent px-0 text-xs"
                            />
                          </div>
                          <div class="min-w-0">
                            <h4 class="mt-1.5 font-semibold md:mt-0">{change.title}</h4>
                            <p class="mt-0.5 max-w-prose leading-relaxed text-muted">
                              {change.description}
                            </p>
                            {#if change.href}<a
                                class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-link underline underline-offset-4 md:min-h-8"
                                href={change.href}
                                >{m.changelog_details()} <Icon name="arrow-right" size={14} /></a
                              >{/if}
                          </div>
                        </li>
                      {/each}
                    </ul>
                  </article>
                </li>
              {/each}
            </ol>
          </MAAccordionItem>
        {/each}
      </MAAccordion>
      <Pager compact page={data.page} pages={data.pages} href={(page) => href(data.kind, page)} />
    </div>
    <aside class="flex flex-col gap-6 lg:w-96 lg:shrink-0" aria-label={m.changelog_guide()}>
      <section
        class="hidden rounded-lg border border-surface-200-800 bg-panel p-6 md:block"
        aria-labelledby="guide-title"
      >
        <h2 id="guide-title" class="text-xl font-semibold">{m.changelog_guide()}</h2>
        <dl class="mt-4 flex flex-col gap-3.5">
          {#each kinds as kind (kind)}
            <div>
              <dt>
                <StatusBadge
                  status={`changelog:${kind}`}
                  class="h-auto border-0 bg-transparent px-0 text-sm"
                />
              </dt>
              <dd class="mt-1 ml-4 text-sm leading-normal text-muted">{hints[kind]()}</dd>
            </div>
          {/each}
        </dl>
      </section>
      <section
        class="rounded-lg border border-surface-200-800 px-4 py-5 md:p-6"
        aria-labelledby="feedback-title"
      >
        <h2 id="feedback-title" class="text-xl font-semibold">{m.changelog_feedback_title()}</h2>
        <p class="mt-2 text-sm leading-relaxed text-muted">{m.changelog_feedback()}</p>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <a
            class="{buttonClass('secondary', 'sm')} px-4 text-sm font-semibold"
            href="https://github.com/itsmegrave/mesaaberta/issues/new/choose"
            >{m.changelog_suggest()}</a
          >
          <a
            class="inline-flex min-h-11 items-center text-sm font-semibold text-link underline underline-offset-4"
            href="https://github.com/itsmegrave/mesaaberta">{m.changelog_github()}</a
          >
        </div>
      </section>
    </aside>
  </div>
</div>

{#snippet dateBox(value: string, className: string)}
  <div
    class="flex flex-col items-center rounded-lg border border-surface-200-800 text-center {className}"
  >
    <span class="text-xs font-semibold tracking-wider text-muted uppercase"
      >{short(value, 'weekday')}</span
    >
    <span class="leading-tight font-semibold tabular-nums">{date(value, { day: 'numeric' })}</span>
    <span class="text-xs font-semibold tracking-wider text-muted uppercase"
      >{short(value, 'month')}</span
    >
  </div>
{/snippet}
