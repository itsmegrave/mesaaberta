<script lang="ts">
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toolGroupLabels } from '#lib/tools/labels.js';
  import ToolCard from '#lib/components/tools/ui/ToolCard.svelte';

  let { data } = $props();

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

  {#each data.groups as group (group.kind)}
    <section aria-labelledby="tools-{group.kind}" class="mt-10">
      <div class="flex items-baseline gap-3">
        <h2 id="tools-{group.kind}" class="text-2xl font-semibold tracking-tight">
          {toolGroupLabels[group.kind]()}
        </h2>
        <span class="font-semibold text-muted">{group.tools.length}</span>
      </div>
      <CardGrid class="mt-5">
        {#each group.tools as tool (tool.id)}
          <li><ToolCard {tool} /></li>
        {/each}
      </CardGrid>
    </section>
  {/each}

  {#if empty}
    <EmptyState
      text={data.query ? m.tool_empty_search() : m.tool_empty()}
      clearHref={data.query ? '/tools' : undefined}
      clearLabel={m.tool_clear_search()}
    />
  {/if}
</section>
