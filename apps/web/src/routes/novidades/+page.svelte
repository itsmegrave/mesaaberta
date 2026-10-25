<script lang="ts">
  import { onMount } from 'svelte';
  import { asset } from '$app/paths';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import TableIllustration from '#lib/components/ui/TableIllustration.svelte';
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import { releaseHref, type ChangeKind } from '#lib/changelog.js';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data } = $props();
  let slide = $state(0);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const highlight = $derived(data.highlights[slide]);
  const preview = $derived(highlight.preview);
  const filters = [
    { kind: null, label: m.changelog_all, count: 'all' },
    { kind: 'new', label: m.changelog_new, count: 'new' },
    { kind: 'improved', label: m.changelog_improvements, count: 'improved' },
    { kind: 'fixed', label: m.changelog_fixes, count: 'fixed' },
  ] as const;
  const date = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(
      new Date(`${value}T12:00:00Z`),
    );
  const day = (value: string) => date(value, { day: 'numeric', month: 'long', year: 'numeric' });
  const month = (value: string) => {
    const label = date(value, { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const href = (kind: ChangeKind | null, page = 1): `/novidades${string}` => {
    const params = new SvelteURLSearchParams();
    if (kind) params.set('tipo', kind);
    if (page > 1) params.set('page', String(page));
    return `/novidades${params.size ? `?${params}` : ''}`;
  };
  const months = $derived([...new Set(data.entries.map((entry) => entry.date.slice(0, 7)))]);
  const move = (direction: number) => {
    slide = (slide + direction + data.highlights.length) % data.highlights.length;
  };
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(new URL(releaseHref(value), window.location.origin).href);
      toast.success(m.changelog_copied({ date: day(value) }));
    } catch {
      toast.error(m.changelog_copy_failed());
    }
  }
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- release links and reviewed content use canonical paths, including their query and fragment. -->

<svelte:head>
  <title>{m.changelog_title()} · Mesa Aberta</title>
  <meta name="description" content={m.changelog_description()} />
  {#if data.page > 1 || data.kind}<meta name="robots" content="noindex, follow" />{/if}
</svelte:head>

<div class="mx-auto max-w-7xl py-6 md:py-12">
  <Breadcrumbs class="mb-6" items={[{ label: m.changelog_title() }]} />
  <header>
    <h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.changelog_title()}</h1>
    <p class="mt-4 max-w-2xl leading-relaxed text-muted">{m.changelog_lede()}</p>
  </header>

  <section class="mt-10" aria-label={m.changelog_highlights()} aria-roledescription="carousel">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-semibold">{m.changelog_highlights()}</h2>
      <div class="flex items-center gap-1">
        <MAButton
          disabled={!hydrated}
          size="sm"
          aria-label={m.changelog_previous()}
          onclick={() => move(-1)}><Icon name="chevron-left" size={20} /></MAButton
        >
        {#each data.highlights as item, index (item.date)}
          <MAButton
            disabled={!hydrated}
            size="sm"
            aria-label={m.changelog_slide({ number: index + 1, title: item.title })}
            aria-pressed={slide === index}
            onclick={() => {
              slide = index;
            }}
          >
            <span
              aria-hidden="true"
              class="h-2 rounded-full {slide === index
                ? 'w-6 bg-surface-950-50'
                : 'w-2 bg-surface-300-700'}"
            ></span>
          </MAButton>
        {/each}
        <MAButton
          disabled={!hydrated}
          size="sm"
          aria-label={m.changelog_next()}
          onclick={() => move(1)}><Icon name="chevron-right" size={20} /></MAButton
        >
        <span class="ml-2 text-sm text-muted tabular-nums" aria-live="polite"
          >{m.changelog_slide_count({ current: slide + 1, total: data.highlights.length })}</span
        >
      </div>
    </div>
    <div
      class="grid overflow-hidden rounded-lg border border-surface-200-800 bg-panel md:grid-cols-5"
    >
      <div
        class="flex min-h-64 items-center justify-center border-b border-surface-200-800 bg-surface-wash p-5 md:col-span-3 md:border-r md:border-b-0 md:p-8"
      >
        {#if preview}
          <img
            src={asset(`changelog/${preview}-light.jpg`)}
            alt={m.changelog_preview({ title: highlight.changes[0].title })}
            width={preview === 'profile' ? 976 : 576}
            height={preview === 'profile' ? 952 : preview === 'chat' ? 186 : 300}
            class="h-auto max-h-80 w-full rounded-lg border border-surface-200-800 object-contain dark:hidden"
          />
          <img
            src={asset(`changelog/${preview}-dark.jpg`)}
            alt={m.changelog_preview({ title: highlight.changes[0].title })}
            width={preview === 'profile' ? 976 : 576}
            height={preview === 'profile' ? 952 : preview === 'chat' ? 186 : 300}
            class="hidden h-auto max-h-80 w-full rounded-lg border border-surface-200-800 object-contain dark:block"
          />
        {:else}
          <div class="w-full max-w-sm"><TableIllustration /></div>
        {/if}
      </div>
      <div
        class="flex flex-col justify-center p-6 md:col-span-2 md:p-8"
        aria-live="polite"
        aria-atomic="true"
      >
        <time class="text-sm text-muted" datetime={highlight.date}>{day(highlight.date)}</time>
        <h3 class="mt-3 text-2xl leading-tight font-semibold text-balance">{highlight.title}</h3>
        <p class="mt-3 leading-relaxed text-muted">{highlight.summary}</p>
        <a
          class="mt-5 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link underline underline-offset-4"
          href={releaseHref(highlight.date)}
          >{m.changelog_read()} <Icon name="arrow-right" size={16} /></a
        >
      </div>
    </div>
  </section>

  <div class="mt-8 grid items-start gap-8 lg:grid-cols-3">
    <div class="min-w-0 lg:col-span-2">
      <nav
        class="mb-8 flex w-fit max-w-full flex-wrap gap-1 rounded-3xl bg-surface-wash p-1"
        aria-label={m.changelog_filter()}
      >
        {#each filters as filter (filter.count)}
          <a
            href={href(filter.kind)}
            aria-current={data.kind === filter.kind ? 'true' : undefined}
            class="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold {data.kind ===
            filter.kind
              ? 'preset-filled-primary-500'
              : 'hover:bg-surface-wash'}"
          >
            {filter.label()} <span class="text-xs tabular-nums">{data.counts[filter.count]}</span>
          </a>
        {/each}
      </nav>
      {#if !data.entries.length}<p role="status">{m.changelog_empty()}</p>{/if}
      {#each months as group (group)}
        <section class="mb-10" aria-labelledby="month-{group}">
          <h2 id="month-{group}" class="mb-6 text-2xl font-semibold">
            {month(`${group}-01`)}
          </h2>
          <ol class="space-y-6">
            {#each data.entries.filter( (entry) => entry.date.startsWith(group) ) as entry (entry.date)}
              <li id={entry.date} class="relative scroll-mt-8 md:pl-20">
                <div
                  class="absolute inset-y-0 left-8 hidden w-px bg-surface-200-800 md:block"
                  aria-hidden="true"
                ></div>
                <div
                  class="absolute top-0 left-0 hidden w-16 rounded-lg border border-surface-200-800 bg-panel py-2 text-center md:block"
                  aria-hidden="true"
                >
                  <p class="text-xs text-muted uppercase">
                    {date(entry.date, { weekday: 'short' }).replace('.', '')}
                  </p>
                  <p class="text-2xl leading-tight font-semibold tabular-nums">
                    {date(entry.date, { day: 'numeric' })}
                  </p>
                  <p class="text-xs text-muted uppercase">
                    {date(entry.date, { month: 'short' }).replace('.', '')}
                  </p>
                </div>
                <article class="rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6">
                  <div class="flex flex-wrap items-center justify-between gap-x-2">
                    <a href={releaseHref(entry.date)} class="text-xs text-muted hover:underline"
                      ><time datetime={entry.date}
                        >{date(entry.date, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}</time
                      >
                      · {m.changelog_count({ count: entry.changes.length })}</a
                    >
                    <MAButton
                      disabled={!hydrated}
                      size="sm"
                      class="gap-2 text-xs text-muted"
                      aria-label={m.changelog_copy({ date: day(entry.date) })}
                      onclick={() => copy(entry.date)}
                      ><Icon name="copy" size={14} />{m.changelog_copy_label()}</MAButton
                    >
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <h3 class="text-xl leading-tight font-semibold">{entry.title}</h3>
                    {#if entry.date === data.highlights[0].date}<span
                        class="rounded-full bg-surface-wash px-2 py-1 text-xs font-semibold"
                        >{m.changelog_latest()}</span
                      >{/if}
                  </div>
                  <p class="mt-3 text-sm leading-relaxed text-muted">{entry.summary}</p>
                  <ul class="mt-5 divide-y divide-surface-200-800 border-y border-surface-200-800">
                    {#each entry.changes as change (change.title)}
                      <li class="grid gap-2 py-4 sm:grid-cols-4 sm:gap-4">
                        <div>
                          <StatusBadge
                            status={`changelog:${change.kind}`}
                            class="border-0 bg-transparent px-0 text-xs"
                          />
                        </div>
                        <div class="sm:col-span-3">
                          <h4 class="text-sm font-semibold">{change.title}</h4>
                          <p class="mt-1 text-sm leading-relaxed text-muted">
                            {change.description}
                          </p>
                          {#if change.href}<a
                              class="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-link hover:underline"
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
        </section>
      {/each}
      <Pager page={data.page} pages={data.pages} href={(page) => href(data.kind, page)} />
    </div>
    <aside class="space-y-6" aria-label={m.changelog_guide()}>
      <section class="rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6">
        <h2 class="font-semibold">{m.changelog_guide()}</h2>
        <dl class="mt-4 space-y-4">
          {#each ['new', 'improved', 'fixed'] as kind (kind)}
            <div>
              <dt>
                <StatusBadge
                  status={`changelog:${kind as ChangeKind}`}
                  class="border-0 bg-transparent px-0"
                />
              </dt>
              <dd class="mt-1 text-sm leading-relaxed text-muted">
                {kind === 'new'
                  ? m.changelog_new_hint()
                  : kind === 'improved'
                    ? m.changelog_improved_hint()
                    : m.changelog_fixed_hint()}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
      <section class="rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6">
        <h2 class="font-semibold">{m.changelog_feedback_title()}</h2>
        <p class="mt-3 text-sm leading-relaxed text-muted">{m.changelog_feedback()}</p>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <a
            class="btn min-h-11 rounded-lg border border-surface-200-800 px-3 text-sm font-semibold hover:bg-surface-wash"
            href="https://github.com/itsmegrave/mesaaberta/issues/new/choose"
            >{m.changelog_suggest()}</a
          >
          <a
            class="inline-flex min-h-11 items-center text-sm text-link underline underline-offset-4"
            href="https://github.com/itsmegrave/mesaaberta/releases">{m.changelog_github()}</a
          >
        </div>
      </section>
    </aside>
  </div>
</div>
