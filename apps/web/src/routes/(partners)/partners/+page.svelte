<script lang="ts">
  import { navigating, page } from '$app/state';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import PartnerCard from '../components/PartnerCard.svelte';
  import PartnerFilters from '../components/PartnerFilters.svelte';
  import PartnerHowItWorks from '../components/PartnerHowItWorks.svelte';
  import EntityReportDialog from '#lib/components/report/EntityReportDialog.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import { pageHref } from '#lib/admin/page-href.js';
  import { partnerIdSchema } from '@mesaaberta/core/moderation/reports';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { partnerTypeLabels } from '#lib/partners/type-labels.js';
  import { Target } from '#lib/target.svelte.js';

  let { data } = $props();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const anyFilter = $derived(data.filters.query !== '' || data.filters.type !== null);

  const reporting = new Target<{ id: string; name: string }>();
  const withdrawing = new Target<{ id: string; name: string }>();
</script>

<section class="py-2 md:pt-8">
  <PageHead
    crumbs={[{ label: m.partner_nav_label() }]}
    title={m.partner_title()}
    lede={m.partner_lede()}
  />

  {#if data.sent}
    <p role="status" class="mt-6 rounded-lg border border-success-500 bg-panel p-4 font-semibold">
      {m.partner_sent_notice()}
    </p>
  {/if}

  <PartnerHowItWorks />

  <PartnerFilters picked={data.filters} />

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.cards.length > 0}
    <CardGrid class="mt-6">
      {#each data.cards as partner (partner.id)}
        <li>
          <PartnerCard
            {partner}
            canEdit={partner.canEdit}
            onreport={partner.canReport ? (picked) => (reporting.current = picked) : undefined}
            onwithdraw={(picked) => (withdrawing.current = picked)}
          />
        </li>
      {/each}
    </CardGrid>
    <div class="mt-8">
      <Pager
        page={data.filters.page}
        pages={data.pages}
        href={(number) => pageHref('/partners', page.url.searchParams, number)}
      />
    </div>
  {:else}
    <EmptyState
      text={data.filters.type && !data.filters.query
        ? m.partner_empty_type({ type: partnerTypeLabels[data.filters.type]() })
        : anyFilter
          ? m.partner_empty_filtered()
          : m.partner_empty()}
      clearHref={anyFilter ? '/partners' : undefined}
      clearLabel={data.filters.type && !data.filters.query
        ? m.partner_filter_show_all()
        : m.partner_filter_clear()}
    />
  {/if}
</section>

{#if reporting.current}
  {#key reporting.current.id}
    <EntityReportDialog kind="partner" entity={reporting.current} bind:open={reporting.open} />
  {/key}
{/if}

{#if withdrawing.current}
  {#key withdrawing.current.id}
    <ModerationDialog
      bind:open={withdrawing.open}
      trigger={false}
      action="?/withdraw"
      schema={partnerIdSchema}
      fields={{ id: withdrawing.current.id }}
      danger
      label={m.partner_withdraw()}
      title={m.partner_withdraw_title({ name: withdrawing.current.name })}
      text={m.partner_withdraw_text()}
      confirm={m.partner_withdraw_confirm()}
      success={m.partner_withdraw_done()}
    />
  {/key}
{/if}
