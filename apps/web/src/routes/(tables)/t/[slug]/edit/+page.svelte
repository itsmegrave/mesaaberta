<script lang="ts">
  import { copyText } from '#lib/clipboard.js';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import { page } from '$app/state';
  import TableForm from '../../../components/TableForm.svelte';
  import TableHead from '../components/ui/TableHead.svelte';
  import TableTabs from '../components/ui/TableTabs.svelte';
  import { kindLabel } from '#lib/tables/format.js';
  import { m } from '#lib/paraglide/messages.js';

  import { tableFormSchema } from '@mesaaberta/core/tables/schema';
  import { toast } from '#lib/toaster.js';

  let { data, form = null } = $props();
  const options = pageQuery(
    () => data.catalogRead ?? { systems: data.systems, catalog: data.catalog },
  );

  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    ...fromResult(form?.form ?? data.form),
    schema: tableFormSchema,
    domain: 'table',
    onSuccess: () => toast.success(m.toast_table_saved()),
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);

  const tablePage = $derived(`/t/${data.slug}`);
  const systems = $derived(options.data?.systems ?? data.systems);
  // The saved system and kind, like the title: the form's own may be mid-edit.
  const detail = $derived(
    [
      systems.find((system) => system.slug === data.form.data.systemSlug)?.name,
      kindLabel(data.form.data.kind),
    ]
      .filter(Boolean)
      .join(' · '),
  );
  function copyLink() {
    return copyText(new URL(tablePage, page.url.origin).href, m.toast_link_copied());
  }
  const menu = $derived.by(() => {
    const items: KebabItem[] = [
      { id: 'view', label: m.menu_view_table(), icon: 'eye', href: tablePage },
      {
        id: 'players',
        label: m.menu_players(),
        icon: 'game-icons:meeple',
        href: `/t/${data.slug}/manage`,
      },
      { id: 'copy', label: m.menu_copy_link(), icon: 'copy', onselect: copyLink },
    ];
    return items;
  });
</script>

<svelte:head>
  <title>{m.form_edit_title()}</title>
</svelte:head>

<QueryStatus failed={options.isError} retry={() => options.refetch()} />

<section class="py-10 md:py-16">
  <Breadcrumbs
    items={[
      { label: m.nav_my_tables(), href: '/u/tables' },
      { label: data.title, href: `/t/${data.slug}` },
      { label: m.form_edit_title() },
    ]}
  />
  <TableHead title={data.title} {detail} {menu} />
  <TableTabs slug={data.slug} current="edit" />

  {#if data.status === 'disabled'}
    <p role="status" class="mt-4 max-w-sm font-semibold">{m.form_edit_disabled()}</p>
  {/if}

  <TableForm
    {controller}
    {systems}
    catalog={options.data?.catalog ?? data.catalog}
    imageUrl={data.imageUrl}
    action="?/save"
    submitLabel={m.form_submit_edit()}
    cancelHref={tablePage}
    gmName={data.account?.username ?? undefined}
    minCapacity={Math.max(1, data.seatsTaken)}
    manageHref={`/t/${data.slug}/manage`}
    calendarNote
    suggestSystem={data.status === 'draft'}
    places={data.places}
    safety={data.safety}
    ratingSymbol={data.ratingSymbol}
    openTables={data.openTables}
  />
</section>
