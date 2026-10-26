<script lang="ts">
  import DirectoryHeader from '#lib/components/directory/ui/DirectoryHeader.svelte';
  import DirectoryMark from '#lib/components/directory/ui/DirectoryMark.svelte';
  import DirectorySection from '#lib/components/directory/ui/DirectorySection.svelte';
  import PersonRow from '#lib/components/directory/ui/PersonRow.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import TableCard from '#lib/components/ui/TableCard.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { pageQuery } from '#lib/query/page.svelte.js';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const system = $derived(data.system);
  const facts = $derived(data.facts);

  const tablesHref = $derived(`/t?system=${system.slug}`);
  const newHref = $derived(`/t/new?system=${system.slug}`);

  const modality: string | null = $derived(
    data.modalities.length > 1
      ? m.system_modality_both()
      : data.modalities[0] === 'in_person'
        ? m.system_modality_in_person()
        : data.modalities[0] === 'online'
          ? m.system_modality_online()
          : null,
  );
  const chips = $derived(
    [
      m.directory_open_tables({ count: facts.openTables }),
      m.systems_tables_here({ count: facts.totalTables }),
      m.systems_gm_count({ count: facts.gmCount }),
      modality,
    ].filter((chip) => chip !== null),
  );

  const endedOn = new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short' });
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-12">
  <DirectoryHeader
    crumbs={[{ label: m.systems_crumb(), href: '/systems' }, { label: system.name }]}
    name={system.name}
    facts={chips}
    factsLabel={m.system_about()}
    highlightFirst={facts.openTables > 0}
  >
    {#snippet mark()}<DirectoryMark name={system.name} size="lg" />{/snippet}
    {#snippet actions()}
      {#if facts.openTables > 0}
        <a href={tablesHref} class="{buttonClass('primary')} px-6 font-semibold"
          >{m.system_see_open({ count: facts.openTables })}</a
        >
      {/if}
      <a href={newHref} class="{buttonClass('secondary')} px-6 font-semibold"
        >{m.system_new_table()}</a
      >
    {/snippet}
  </DirectoryHeader>

  <DirectorySection
    title={m.system_open_title()}
    moreHref={facts.openTables > data.openTables.length ? tablesHref : undefined}
    moreLabel={m.system_open_all({ count: facts.openTables })}
  >
    {#if data.openTables.length > 0}
      <CardGrid>
        {#each data.openTables as table (table.slug)}
          <li><TableCard {table} /></li>
        {/each}
      </CardGrid>
    {:else}
      <div role="status" class="flex flex-col items-start gap-2 rounded-lg bg-surface-wash p-6">
        <p class="text-lg font-semibold">{m.system_open_empty({ name: system.name })}</p>
        <p class="text-muted">{m.system_open_empty_hint()}</p>
        <a href={newHref} class="mt-2 {buttonClass('primary', 'sm')} px-6 font-semibold"
          >{m.system_new_table()}</a
        >
      </div>
    {/if}
  </DirectorySection>

  {#if data.gms.length > 0}
    <DirectorySection title={m.system_gms_title()} lede={m.system_gms_lede({ name: system.name })}>
      <ul class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each data.gms as gm (gm.username)}
          <li><PersonRow person={gm} detail={m.system_gm_tables({ count: gm.tables })} /></li>
        {/each}
      </ul>
    </DirectorySection>
  {/if}

  {#if data.ended.length > 0}
    <DirectorySection title={m.system_ended_title()}>
      <ul class="border-t border-surface-200-800">
        {#each data.ended as table (table.slug)}
          <li
            class="flex flex-col gap-1 border-b border-surface-200-800 py-4 md:flex-row md:items-center md:gap-6"
          >
            <a
              href="/t/{table.slug}"
              class="flex-1 text-lg font-semibold no-underline hover:underline">{table.title}</a
            >
            <span class="text-sm font-medium text-muted"
              >{m.system_ended_line({
                gm: table.gmName,
                date: endedOn.format(new Date(table.endedAt)),
              })}</span
            >
          </li>
        {/each}
      </ul>
    </DirectorySection>
  {/if}
</section>
