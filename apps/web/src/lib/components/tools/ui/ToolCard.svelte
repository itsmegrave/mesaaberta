<script lang="ts">
  // One tool of Ferramentas: its logo (or its initial) on the tile, the name, its kinds and a line
  // about it, then its site (a new tab, said for a screen reader) and, for a table platform, the
  // open tables that play on it. A suggestion still waiting wears "Em análise".
  import Icon from '#lib/components/ui/Icon.svelte';
  import MediaCard from '#lib/components/ui/MediaCard.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toolHost, toolKindLabels } from '#lib/tools/labels.js';
  import type { ToolKind } from '@mesaaberta/core/tools/schema';

  type Tool = {
    name: string;
    /** Every section it shows in; none yet in the form's preview. */
    kinds: readonly ToolKind[];
    siteUrl: string;
    description: string;
    logoUrl: string | null;
    platformSlug: string | null;
    openTables: number;
    pending: boolean;
  };

  let { tool }: { tool: Tool } = $props();

  const host = $derived(toolHost(tool.siteUrl));
  const initial = $derived(tool.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?');
</script>

<MediaCard
  mediaClass="flex items-center justify-center"
  pill={tool.pending ? m.partner_status_pending() : undefined}
  pillTone="warning"
>
  {#snippet media()}
    {#if tool.logoUrl}
      <img
        src={tool.logoUrl}
        alt=""
        width="64"
        height="64"
        loading="lazy"
        decoding="async"
        class="size-16 object-contain"
      />
    {:else}
      <span
        aria-hidden="true"
        class="flex size-16 items-center justify-center rounded-lg border border-surface-200-800 bg-panel text-3xl font-bold"
        >{initial}</span
      >
    {/if}
  {/snippet}

  <div>
    <h3 class="text-lg leading-snug font-semibold text-balance">{tool.name}</h3>
    {#if tool.kinds.length > 0}
      <ul class="mt-2 flex flex-wrap gap-2">
        {#each tool.kinds as kind (kind)}
          <li><Pill tone="muted">{toolKindLabels[kind]()}</Pill></li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if tool.description}<p class="text-sm text-muted">{tool.description}</p>{/if}

  {#snippet footer()}
    {#if host}
      <!-- eslint-disable svelte/no-navigation-without-resolve -- the tool's own site, not an app route -->
      <a
        href={tool.siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 min-w-0 items-center gap-1 anchor text-sm font-semibold"
      >
        <span class="truncate">{host}</span>
        <span class="sr-only"> {m.tool_opens_new_tab()}</span>
        <Icon name="external-link" size={16} class="shrink-0 text-muted" />
      </a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    {/if}
    {#if tool.platformSlug && tool.openTables > 0}
      <a
        href="/tables?platform={encodeURIComponent(tool.platformSlug)}"
        class="inline-flex min-h-11 shrink-0 items-center anchor text-sm font-semibold"
        >{m.tool_open_tables({ count: tool.openTables })}</a
      >
    {/if}
  {/snippet}
</MediaCard>
