<script lang="ts">
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toolGroupLabels } from '#lib/tools/labels.js';
  import ToolCard from '#lib/components/tools/ui/ToolCard.svelte';
  import { ToolSections } from './sections.svelte.js';

  let { data } = $props();

  // Each kind is a section that folds (a tool with several kinds is in each). On a phone they are
  // pages: one open at a time, picked from the chips, the buttons under it or a sideways swipe.
  const sections = new ToolSections(() => data.groups.map((group) => group.kind));

  // svelte-ignore state_referenced_locally
  let text = $state(data.query);
  const empty = $derived(data.groups.length === 0 && data.pending.length === 0);
</script>

<section class="py-2 md:pt-8">
  <PageHead crumbs={[{ label: m.nav_tools() }]} title={m.tool_title()} lede={m.tool_lede()}>
    {#snippet actions()}
      <a href="/tools/new" class="{buttonClass('primary')} shrink-0 gap-2 font-semibold"
        ><Icon name="plus" size={18} />{m.tool_suggest()}</a
      >
    {/snippet}
  </PageHead>

  {#if data.sent}
    <p role="status" class="mt-6 rounded-lg border border-success-500 bg-panel p-4 font-semibold">
      {m.tool_sent_notice()}
    </p>
  {/if}

  <!-- A plain GET form: sending it reloads the page with `?q=`, and an empty one shows them all. -->
  <form role="search" method="get" action="/tools" class="relative mt-8 w-full md:w-85">
    <Icon
      name="search"
      size={16}
      class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
    />
    <TextInput
      id="tools-search"
      name="q"
      type="search"
      maxlength={100}
      aria-label={m.tool_search_label()}
      placeholder={m.tool_search_label()}
      bind:value={text}
      class="input h-11 w-full rounded-lg border-control border-surface-200-800 pr-3 pl-10 text-sm"
    />
  </form>

  {#if data.pending.length > 0}
    <section aria-labelledby="tools-pending" class="mt-10">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="tools-pending" class="text-2xl font-semibold tracking-tight">
          {m.tool_pending_title()}
        </h2>
        <p class="text-muted">{m.tool_pending_hint()}</p>
      </div>
      <CardGrid class="mt-5">
        {#each data.pending as tool (tool.id)}
          <li><ToolCard {tool} /></li>
        {/each}
      </CardGrid>
    </section>
  {/if}

  {#if data.groups.length > 0}
    {#if sections.paged && data.groups.length > 1}
      <!-- A phone's index of the sections: tapping one opens it alone. The row scrolls sideways
           when the chips do not fit. -->
      <nav
        aria-label={m.tool_sections_label()}
        class="-mx-5 mt-8 flex snap-x scroll-px-5 scrollbar-none gap-2 overflow-x-auto px-5 pb-1 md:hidden [&::-webkit-scrollbar]:hidden"
      >
        {#each data.groups as group (group.kind)}
          {@const active = sections.current === group.kind}
          <MAButton
            size="custom"
            class="flex h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm {active
              ? 'border-primary-500 preset-filled-primary-500 font-semibold'
              : 'border-surface-200-800 bg-panel'}"
            aria-controls="tools-{group.kind}"
            aria-current={active || undefined}
            onclick={() => sections.show(group.kind)}
          >
            {toolGroupLabels[group.kind]()}
            <span class="tabular-nums {active ? '' : 'text-muted'}">{group.tools.length}</span>
          </MAButton>
        {/each}
      </nav>
    {/if}

    <MAAccordion bind:value={sections.open} class="mt-6 border-y border-surface-200-800 md:mt-10">
      {#each data.groups as group, index (group.kind)}
        {@const previous = data.groups[index - 1]}
        {@const next = data.groups[index + 1]}
        <div id="tools-{group.kind}" class="scroll-mt-6">
          <MAAccordionItem
            value={group.kind}
            title={toolGroupLabels[group.kind]()}
            summary={m.tool_count({ count: group.tools.length })}
            titleClass="text-xl leading-tight font-semibold tracking-tight md:text-2xl"
          >
            <div {...sections.swipe}>
              <CardGrid class="pt-2">
                {#each group.tools as tool (tool.id)}
                  <li><ToolCard {tool} /></li>
                {/each}
              </CardGrid>
              {#if sections.paged && data.groups.length > 1}
                <div class="mt-6 flex items-center justify-between gap-3 md:hidden">
                  <MAButton
                    variant="secondary"
                    size="icon"
                    aria-label={previous
                      ? `${m.tool_section_previous()}: ${toolGroupLabels[previous.kind]()}`
                      : m.tool_section_previous()}
                    aria-disabled={!previous || undefined}
                    onclick={() => previous && sections.show(previous.kind)}
                  >
                    <Icon name="arrow-left" size={18} />
                  </MAButton>
                  <span class="text-sm font-semibold text-muted tabular-nums">
                    {m.tool_section_position({ current: index + 1, total: data.groups.length })}
                  </span>
                  <MAButton
                    variant="secondary"
                    size="icon"
                    aria-label={next
                      ? `${m.tool_section_next()}: ${toolGroupLabels[next.kind]()}`
                      : m.tool_section_next()}
                    aria-disabled={!next || undefined}
                    onclick={() => next && sections.show(next.kind)}
                  >
                    <Icon name="arrow-right" size={18} />
                  </MAButton>
                </div>
              {/if}
            </div>
          </MAAccordionItem>
        </div>
      {/each}
    </MAAccordion>
  {/if}

  {#if empty}
    <EmptyState
      text={data.query ? m.tool_empty_search() : m.tool_empty()}
      clearHref={data.query ? '/tools' : undefined}
      clearLabel={m.tool_clear_search()}
    />
  {/if}
</section>
