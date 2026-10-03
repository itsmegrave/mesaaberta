<script lang="ts">
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { guardDraft } from '$lib/forms/guard.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import { page } from '$app/state';
  import TableForm from '$lib/components/TableForm.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { tableFormSchema } from '$lib/tables/schema';
  import { toast } from '$lib/toaster';

  let { data, form = null } = $props();
  const options = pageQuery(
    () => data.catalogRead ?? { systems: data.systems, catalog: data.catalog },
  );

  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
  const controller = actionForm({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
    schema: tableFormSchema,
    domain: 'table',
    onSuccess: () => toast.success(m.toast_table_saved()),
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);

  const locale = getLocale();
  const tablePage = $derived(localizedHref(`/tables/${data.slug}`, locale));
  let disableOpen = $state(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(tablePage, page.url.origin).href);
      toast.success(m.toast_link_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }
  const menu = $derived.by(() => {
    const items: KebabItem[] = [
      { id: 'view', label: m.menu_view_table(), icon: 'eye', href: tablePage },
      {
        id: 'players',
        label: m.menu_players(),
        icon: 'game-icons:meeple',
        href: localizedHref(`/tables/${data.slug}/manage`, locale),
      },
      { id: 'copy', label: m.menu_copy_link(), icon: 'copy', onselect: copyLink },
    ];
    if (data.status === 'active') {
      items.push({
        id: 'disable',
        label: m.menu_disable_table(),
        icon: 'trash',
        destructive: true,
        onselect: () => (disableOpen = true),
      });
    }
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
      { label: m.nav_my_tables(), href: '/account/tables' },
      { label: data.title, href: `/tables/${data.slug}` },
      { label: m.form_edit_title() },
    ]}
  />
  <div class="mt-6 flex items-start justify-between gap-3">
    <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
      {m.form_edit_title()}
    </h1>
    <KebabMenu name={data.title} items={menu} />
  </div>

  {#if data.status === 'disabled'}
    <p role="status" class="mt-4 max-w-sm font-semibold">{m.form_edit_disabled()}</p>
  {/if}

  <TableForm
    {controller}
    systems={options.data?.systems ?? data.systems}
    catalog={options.data?.catalog ?? data.catalog}
    imageUrl={data.imageUrl}
    action="?/save"
    submitLabel={m.form_submit_edit()}
    cancelHref={tablePage}
    gmName={data.account?.username ?? undefined}
    minCapacity={Math.max(1, data.seatsTaken)}
    manageHref={localizedHref(`/tables/${data.slug}/manage`, locale)}
    calendarNote
  />

  <ConfirmDialog
    bind:open={disableOpen}
    action="?/disable"
    label={m.form_disable()}
    title={m.form_disable_confirm_title()}
    text={m.form_disable_confirm_text()}
    success={m.toast_table_disabled()}
  />
</section>
