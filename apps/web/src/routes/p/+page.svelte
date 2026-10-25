<script lang="ts">
  import { navigating, page } from '$app/state';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import ListSkeleton from '#lib/components/ListSkeleton.svelte';
  import PartnerCard from '#lib/components/PartnerCard.svelte';
  import PartnerFilters from '#lib/components/PartnerFilters.svelte';
  import PartnerHowItWorks from '#lib/components/PartnerHowItWorks.svelte';
  import PartnerReportDialog from '#lib/components/PartnerReportDialog.svelte';
  import Pager from '#lib/components/admin/Pager.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import { pageHref } from '#lib/admin/page-href.js';
  import { partnerIdSchema } from '@mesaaberta/core/moderation/reports';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data } = $props();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const anyFilter = $derived(data.filters.query !== '');

  let reporting = $state<{ id: string; name: string } | null>(null);
  let withdrawing = $state<{ id: string; name: string } | null>(null);
</script>

<svelte:head>
  <title>{m.partner_title()}</title>
  <meta name="description" content={m.partner_description()} />
</svelte:head>

<section class="py-2 md:pt-12">
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
            onreport={partner.canReport ? (picked) => (reporting = picked) : undefined}
            onwithdraw={(picked) => (withdrawing = picked)}
          />
        </li>
      {/each}
    </CardGrid>
    <div class="mt-8">
      <Pager
        page={data.filters.page}
        pages={data.pages}
        href={(number) => pageHref('/p', page.url.searchParams, number)}
      />
    </div>
  {:else}
    <EmptyState
      text={anyFilter ? m.partner_empty_filtered() : m.partner_empty()}
      clearHref={anyFilter ? '/p' : undefined}
      clearLabel={m.partner_filter_clear()}
    />
  {/if}
</section>

{#if reporting}
  {#key reporting.id}
    <PartnerReportDialog
      partner={reporting}
      bind:open={() => reporting !== null, (value) => !value && (reporting = null)}
    />
  {/key}
{/if}

{#if withdrawing}
  {#key withdrawing.id}
    <ModerationDialog
      bind:open={() => withdrawing !== null, (value) => !value && (withdrawing = null)}
      trigger={false}
      action="?/withdraw"
      schema={partnerIdSchema}
      fields={{ id: withdrawing.id }}
      danger
      label={m.partner_withdraw()}
      title={m.partner_withdraw_title({ name: withdrawing.name })}
      text={m.partner_withdraw_text()}
      confirm={m.partner_withdraw_confirm()}
      success={m.partner_withdraw_done()}
    />
  {/key}
{/if}
