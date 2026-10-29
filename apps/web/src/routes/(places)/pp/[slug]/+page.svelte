<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import DirectorySection from '#lib/components/directory/ui/DirectorySection.svelte';
  import { namesSummary } from '#lib/components/directory/summary.js';
  import EntityReportDialog from '#lib/components/report/EntityReportDialog.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import TableCard from '#lib/components/ui/TableCard.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import {
    placeArea,
    placeKindIcons,
    placeKindLabels,
    placeMapHref,
    placeTagLabel,
  } from '#lib/places/labels.js';
  import { networkIcons, networkLabels } from '#lib/profile/social-presentation.js';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import { formatCep } from '@mesaaberta/core/location/cep';
  import { placeOwnerSchema } from '@mesaaberta/core/places/claims';
  import { tagHref } from '@mesaaberta/core/places/filters';
  import type { Network } from '@mesaaberta/core/profile/social-links';

  import { page } from '$app/state';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const place = $derived(data.place);

  const area = $derived(placeArea(place));
  const street = $derived([place.street, place.complement].filter(Boolean).join(', '));
  const mapHref = $derived(placeMapHref(place));
  const facts = $derived(
    [area, place.openingHours, m.directory_open_tables({ count: data.openTables })].filter(
      (fact): fact is string => !!fact,
    ),
  );
  const links = $derived([
    ...(place.siteUrl ? [{ network: 'website' as Network, url: place.siteUrl }] : []),
    ...data.links,
  ]);
  const newTableHref = $derived(`/tables/new?place=${place.slug}`);
  // The catalog tags it picked (approved; pending ones only reach whoever may edit it).
  const approved = $derived(data.features.filter((feature) => !feature.pending));
  // Off (`use_place_tags`), the tags are the ones made from its address, kind and Comodidades.
  const tags = $derived([
    ...(data.placeTags ? data.features : approved).map((feature) => ({
      kind: 'feature',
      label: feature.name,
      slug: feature.slug,
      pending: feature.pending === true,
    })),
    ...data.tags.map((tag) => ({ ...tag, pending: false })),
  ]);
  let reporting = $state(false);
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

{#if data.canReport && data.account}
  {#key place.id}
    <EntityReportDialog
      kind="place"
      entity={{ id: place.id, name: place.name }}
      bind:open={reporting}
    />
  {/key}
{/if}

<section class="py-2 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.places_crumb(), href: '/places' }, { label: place.name }]}
  />

  {#if data.pending || data.hidden}
    <div
      role="status"
      class="mb-8 flex flex-col gap-3 rounded-lg border border-lamp bg-lamp-wash p-5 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <p class="font-semibold">
          {data.hidden ? m.place_hidden_title() : m.place_pending_title()}
        </p>
        <p class="mt-1 text-sm">
          {data.hidden ? m.place_hidden_text() : m.place_pending_text()}
        </p>
      </div>
      {#if data.canEdit}
        <a
          href="/pp/{place.slug}/edit"
          class="{buttonClass('secondary', 'sm')} shrink-0 px-5 font-semibold">{m.place_edit()}</a
        >
      {/if}
    </div>
  {/if}

  <header class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <Pill tone="outline">{placeKindLabels[place.kind]()}</Pill>
      {#if place.verified}
        <Pill tone="primary"><Icon name="check" size={14} class="mr-1" />{m.place_verified()}</Pill>
      {/if}
    </div>
    {#if data.partner}
      <a
        href="/p/{data.partner.id}"
        class="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-link underline underline-offset-4"
        ><Icon name="game-icons:shaking-hands" size={20} />{m.place_partner_badge({
          name: data.partner.name,
        })}</a
      >
    {/if}
    <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
      {place.name}
    </h1>
    <ul aria-label={m.place_about()} class="flex flex-wrap gap-2">
      {#each facts as fact, index (fact)}
        <li
          class="inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold {index ===
            facts.length - 1 && data.openTables > 0
            ? 'bg-lamp-wash'
            : 'bg-surface-wash'}"
        >
          {fact}
        </li>
      {/each}
    </ul>
  </header>

  <div class="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-12">
    <div class="min-w-0">
      <div class="aspect-5/2 overflow-hidden rounded-lg bg-surface-wash">
        {#if place.imageUrl}
          <img src={place.imageUrl} alt="" class="size-full object-cover" />
        {:else}
          <div class="flex size-full items-center justify-center">
            <span
              aria-hidden="true"
              class="flex size-24 items-center justify-center rounded-xl preset-filled-primary-500"
            >
              <Icon name={placeKindIcons[place.kind]} size={48} />
            </span>
          </div>
        {/if}
      </div>

      {#if place.description}
        <DirectorySection title={m.place_about()}>
          <p class="text-lg whitespace-pre-line">{place.description}</p>
        </DirectorySection>
      {/if}

      {#if !data.placeTags && approved.length > 0}
        <DirectorySection
          title={m.place_amenities()}
          summary={m.place_amenities_summary({
            count: approved.length,
            names: namesSummary(approved.map((feature) => feature.name)),
          })}
        >
          <ul class="flex flex-wrap gap-2">
            {#each approved as feature (feature.slug)}
              <li
                class="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-wash px-3 text-sm font-semibold"
              >
                <Icon name="check" size={16} />{feature.name}
              </li>
            {/each}
          </ul>
        </DirectorySection>
      {/if}

      {#if tags.length > 0}
        <DirectorySection
          title={m.place_tags()}
          lede={data.placeTags ? m.place_tags_hint_catalog() : m.place_tags_hint()}
          summary={data.placeTags
            ? m.place_tags_summary_catalog({ count: tags.length })
            : m.place_tags_summary({ count: tags.length })}
        >
          <ul class="flex flex-wrap gap-2">
            {#each tags as tag (tag.kind + tag.slug)}
              <li>
                {#if tag.pending}
                  <!-- Waiting for an admin: no filter has it yet. -->
                  <span
                    class="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-surface-200-800 px-3 text-sm font-semibold text-muted"
                    >{tag.label}<span class="text-xs font-normal">({m.form_catalog_pending()})</span
                    ></span
                  >
                {:else}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- tagHref builds a /places filter address -->
                  <a
                    href={tagHref(tag, data.tags)}
                    class="inline-flex h-8 items-center rounded-full border border-surface-200-800 px-3 text-sm font-semibold no-underline hover:bg-surface-wash"
                    >{placeTagLabel(tag)}</a
                  >
                {/if}
              </li>
            {/each}
          </ul>
        </DirectorySection>
      {/if}
    </div>

    <aside class="flex flex-col gap-6">
      {#if data.owner}
        <section class="rounded-lg border border-surface-200-800 bg-panel p-5">
          <h2 class="font-semibold">{m.place_owner_title()}</h2>
          <p class="mt-1 text-sm text-muted">{m.place_owner_text()}</p>
          <a
            href="/pp/{place.slug}/edit"
            class="mt-4 {buttonClass('secondary', 'sm')} w-full font-semibold"
            >{m.place_edit_place()}</a
          >
          <ModerationDialog
            action="?/release"
            schema={placeOwnerSchema}
            fields={{ id: place.id }}
            danger
            label={m.place_release()}
            title={m.place_release_title({ name: place.name })}
            text={m.place_release_text()}
            confirm={m.place_release_confirm()}
            success={m.place_release_done()}
            triggerClass="mt-2 {buttonClass('ghost', 'sm')} w-full font-semibold text-muted"
          />
        </section>
      {:else if data.claimable}
        <section class="rounded-lg border border-surface-200-800 bg-panel p-5">
          <h2 class="font-semibold">{m.place_claim_title()}</h2>
          <p class="mt-1 text-sm text-muted">{m.place_claim_text()}</p>
          <a
            href="/pp/{place.slug}/claim"
            class="mt-4 {buttonClass('secondary', 'sm')} w-full font-semibold"
            >{m.place_claim_cta()}</a
          >
        </section>
      {/if}

      <section aria-labelledby="place-address" class="flex flex-col gap-1">
        <h2 id="place-address" class="text-sm font-semibold text-muted">{m.place_address()}</h2>
        <p class="font-semibold">{street}</p>
        <p>{area}</p>
        <p class="text-sm text-muted">{m.place_cep({ cep: formatCep(place.postalCode) })}</p>
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- OpenStreetMap, not an app route -->
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-flex items-center gap-1 font-semibold text-link underline underline-offset-4"
          >{m.place_map()}<Icon name="external-link" size={16} /></a
        >
      </section>

      {#if place.openingHours}
        <section aria-labelledby="place-hours" class="flex flex-col gap-1">
          <h2 id="place-hours" class="text-sm font-semibold text-muted">{m.place_hours()}</h2>
          <p>{place.openingHours}</p>
        </section>
      {/if}

      {#if links.length > 0}
        <section aria-labelledby="place-links" class="flex flex-col gap-1">
          <h2 id="place-links" class="text-sm font-semibold text-muted">{m.place_links()}</h2>
          <ul class="flex flex-wrap items-center gap-1">
            {#each links as link (link.network + link.url)}
              {@const network = networkLabels[link.network]()}
              <li>
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the place's own site or profile on another site -->
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn size-11 rounded-full p-0 text-surface-950-50 hover:preset-tonal"
                  aria-label={m.partner_link_label({ network, name: place.name })}
                  title={network}
                >
                  <Icon name={networkIcons[link.network]} size={22} />
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if !data.pending && !data.hidden}
        <section class="rounded-lg bg-surface-wash p-5">
          <h2 class="font-semibold">{m.place_host_title()}</h2>
          <p class="mt-1 text-sm text-muted">{m.place_host_text({ name: place.name })}</p>
          <a href={newTableHref} class="mt-4 {buttonClass('primary', 'sm')} w-full font-semibold"
            >{m.place_host_cta()}</a
          >
        </section>
      {/if}

      <p class="text-sm text-muted">{m.place_reviewed()}</p>
      {#if data.canReport && !data.account}
        <a
          href="/login?next={encodeURIComponent(page.url.pathname)}"
          class="{buttonClass(
            'ghost',
            'sm',
          )} -ml-3 gap-2 self-start text-sm font-semibold text-muted no-underline"
          ><Icon name="flag" size={16} />{m.place_report()}</a
        >
      {:else if data.canReport}
        <MAButton
          size="sm"
          class="-ml-3 gap-2 self-start text-sm font-semibold text-muted hover:preset-tonal"
          onclick={() => (reporting = true)}
          ><Icon name="flag" size={16} />{m.place_report()}</MAButton
        >
      {/if}
    </aside>
  </div>

  <!-- Full width, like a system's page: the cards need the room the aside would take. -->
  <DirectorySection title={m.place_tables_title()}>
    {#if data.tables.length > 0}
      <CardGrid>
        {#each data.tables as table (table.slug)}
          <li><TableCard {table} /></li>
        {/each}
      </CardGrid>
    {:else}
      <div class="flex flex-col items-start gap-2 rounded-lg bg-surface-wash p-6">
        <p class="text-lg font-semibold">{m.place_tables_empty()}</p>
        <p class="text-muted">{m.place_tables_empty_hint()}</p>
      </div>
    {/if}
  </DirectorySection>
</section>
