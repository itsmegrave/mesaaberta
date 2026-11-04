<script lang="ts">
  import {
    emptySchema,
    logoDecisionSchema,
    type LogoStatus,
  } from '@mesaaberta/core/admin/system-logos';
  import { listPath, listQuery } from '@mesaaberta/core/admin/list';
  import { page as current } from '$app/state';
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import SegmentedFilter from '#lib/components/admin/SegmentedFilter.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';
  import LogoSearch from './components/LogoSearch.svelte';
  import LogoUploadForm from './components/LogoUploadForm.svelte';

  let { data } = $props();

  const statusLabel: Record<LogoStatus, string> = {
    pending: m.admin_logos_status_pending(),
    approved: m.admin_logos_status_approved(),
    rejected: m.admin_logos_status_rejected(),
    missing: m.admin_logos_status_missing(),
  };
  const statuses = $derived(
    (['pending', 'approved', 'rejected', 'missing'] as const).map((value) => ({
      value,
      label: statusLabel[value],
      count: data.counts[value],
    })),
  );
  const confidence: Record<string, string> = {
    high: m.admin_logos_confidence_high(),
    medium: m.admin_logos_confidence_medium(),
    low: m.admin_logos_confidence_low(),
  };
  const method: Record<string, string> = {
    wikidata: m.admin_logos_method_wikidata(),
    commons: m.admin_logos_method_commons(),
    website: m.admin_logos_method_website(),
    wikipedia: m.admin_logos_method_wikipedia(),
    upload: m.admin_logos_method_upload(),
  };
  // The finder writes the reason as a code ("no_logo"), or "image_unreadable: <url>".
  const reasons: Record<string, () => string> = {
    no_wikidata_item: m.admin_logos_reason_no_wikidata_item,
    no_logo: m.admin_logos_reason_no_logo,
    only_svg: m.admin_logos_reason_only_svg,
    image_unreadable: m.admin_logos_reason_image_unreadable,
  };
  const reasonOf = (note: string | null) => reasons[note?.split(':')[0] ?? '']?.() ?? note;
  const pageHref = (n: number) =>
    listPath(
      current.url.pathname,
      listQuery(current.url.searchParams, { page: n === 1 ? null : String(n) }),
    );
  const decisionError = () => m.admin_dialog_error();
</script>

<AdminPage
  title={m.admin_logos_title()}
  lede={m.admin_logos_lede()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_catalog_title(), href: '/admin/catalog?kind=system' },
    { label: m.admin_logos_title() },
  ]}
>
  {#snippet actions()}
    {#if data.status === 'pending' && data.counts.pending > 0}
      <PostButton
        action="?/approveSure"
        schema={emptySchema}
        errorMessage={decisionError}
        variant="primary"
        size="md"
        onResult={(result) => {
          if (result.type === 'success') {
            const approved = (result.data as { approved?: number } | undefined)?.approved ?? 0;
            toast.success(m.admin_logos_approved_toast({ count: approved }));
          }
        }}>{m.admin_logos_approve_sure()}</PostButton
      >
    {/if}
    {#if data.status === 'missing' && data.counts.missing > 0}
      <PostButton
        action="?/forgetMissing"
        schema={emptySchema}
        errorMessage={decisionError}
        variant="secondary"
        size="md"
        onResult={(result) => {
          if (result.type === 'success') {
            const forgotten = (result.data as { forgotten?: number } | undefined)?.forgotten ?? 0;
            toast.success(m.admin_logos_forgot_missing_toast({ count: forgotten }));
          }
        }}>{m.admin_logos_forget_missing()}</PostButton
      >
    {/if}
  {/snippet}

  <LogoSearch unsearched={data.unsearched} />

  <SegmentedFilter
    name="status"
    label={m.admin_logos_status()}
    options={statuses}
    value={data.status}
    class="mt-6"
  />

  {#if data.logos.length === 0}
    <EmptyState text={m.admin_logos_empty()} />
  {:else}
    <ul class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each data.logos as logo (logo.systemId)}
        <li class="flex flex-col gap-3 rounded-lg border border-surface-200-800 p-4">
          {#if logo.src}
            <!-- A neutral backdrop: a logo drawn for a light or a dark page shows on both. -->
            <div class="flex h-32 items-center justify-center rounded-md bg-surface-wash p-3">
              <img
                src={logo.src}
                alt={m.system_logo_alt({ name: logo.name })}
                loading="lazy"
                class="max-h-full max-w-full object-contain"
              />
            </div>
          {/if}
          <div class="flex flex-wrap items-center gap-2">
            <a href="/s/{logo.slug}" class="font-semibold">{logo.name}</a>
            {#if logo.confidence}
              <Pill
                tone={logo.confidence === 'high'
                  ? 'primary'
                  : logo.confidence === 'medium'
                    ? 'outline'
                    : 'warning'}>{confidence[logo.confidence]}</Pill
              >
            {/if}
          </div>
          <div class="flex flex-col gap-1 text-sm">
            {#if logo.method}<p>{method[logo.method] ?? logo.method}</p>{/if}
            {#if logo.status === 'missing'}
              <p class="text-muted">{reasonOf(logo.note)}</p>
            {:else if logo.note}
              <p class="text-muted">{logo.note}</p>
            {/if}
            {#if logo.license}<p>{m.admin_logos_license({ license: logo.license })}</p>{/if}
            {#if logo.attribution}<p>
                {m.admin_logos_attribution({ name: logo.attribution })}
              </p>{/if}
            <p class="flex flex-wrap gap-x-4">
              {#if logo.sourcePage}
                <a href={logo.sourcePage} rel="noopener noreferrer nofollow" target="_blank"
                  >{m.admin_logos_source()}</a
                >
              {/if}
              {#if logo.wikidataId}
                <a
                  href="https://www.wikidata.org/wiki/{logo.wikidataId}"
                  rel="noopener noreferrer nofollow"
                  target="_blank">{m.admin_logos_wikidata()}</a
                >
              {/if}
            </p>
          </div>
          <div class="mt-auto flex flex-wrap gap-2">
            {#if logo.status === 'pending'}
              <PostButton
                action="?/approve"
                fields={{ systemId: logo.systemId }}
                schema={logoDecisionSchema}
                errorMessage={decisionError}
                success={m.admin_logos_toast_approve()}
                error={(errors) => (errors._errors?.[0] ? decisionError() : undefined)}
                variant="primary"
                size="sm">{m.admin_logos_approve()}</PostButton
              >
            {/if}
            {#if logo.status === 'pending' || logo.status === 'approved'}
              <PostButton
                action="?/reject"
                fields={{ systemId: logo.systemId }}
                schema={logoDecisionSchema}
                errorMessage={decisionError}
                success={m.admin_logos_toast_reject()}
                error={(errors) => (errors._errors?.[0] ? decisionError() : undefined)}
                variant="secondary"
                size="sm">{m.admin_logos_reject()}</PostButton
              >
            {/if}
            {#if logo.status === 'missing' || logo.status === 'rejected'}
              <PostButton
                action="?/forget"
                fields={{ systemId: logo.systemId }}
                schema={logoDecisionSchema}
                errorMessage={decisionError}
                success={m.admin_logos_toast_forget()}
                error={(errors) => (errors._errors?.[0] ? decisionError() : undefined)}
                variant="secondary"
                size="sm">{m.admin_logos_forget()}</PostButton
              >
            {/if}
          </div>
          {#if logo.status === 'missing' || logo.status === 'rejected'}
            <LogoUploadForm systemId={logo.systemId} name={logo.name} />
          {/if}
        </li>
      {/each}
    </ul>
    <Pager page={data.page} pages={data.pages} href={pageHref} class="mt-6" />
  {/if}
</AdminPage>
