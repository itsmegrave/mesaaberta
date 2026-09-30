<script lang="ts">
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { queryClient } from '$lib/query/context';
  import { afterWrite } from '$lib/query/invalidate';
  import { pageQuery } from '$lib/query/page.svelte';
  const client = queryClient();
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { confirmLeave } from '$lib/forms/leave-guard.svelte';
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import ConfirmAction from '$lib/components/ConfirmAction.svelte';
  import TableForm from '$lib/components/TableForm.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { tableFormSchema } from '$lib/tables/schema';
  import { toast } from '$lib/toaster';

  let { data } = $props();
  const options = pageQuery(
    () => data.catalogRead ?? { systems: data.systems, catalog: data.catalog },
  );

  // svelte-ignore state_referenced_locally
  const superform = superForm(data.form, {
    validators: zod4Client(tableFormSchema),
    // A table form is long: leaving it with changes asks first.
    taintedMessage: confirmLeave,
    // A saved table goes back to its manage page; the toast says it went through.
    onResult: ({ result }) => {
      if (result.type === 'redirect') {
        void afterWrite(client, 'table');
        toast.success(m.toast_table_saved());
      }
    },
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
  <a href={localizedHref(`/tables/${data.slug}`, getLocale())} class="anchor md:hidden">
    {m.form_view_table()}
  </a>

  <h1 class="mt-6 text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.form_edit_title()}
  </h1>

  {#if data.status === 'disabled'}
    <p role="status" class="mt-4 max-w-sm font-semibold">{m.form_edit_disabled()}</p>
  {/if}

  <TableForm
    {superform}
    systems={options.data?.systems ?? data.systems}
    catalog={options.data?.catalog ?? data.catalog}
    imageUrl={data.imageUrl}
    action="?/save"
    submitLabel={m.form_submit_edit()}
    cancelHref={localizedHref(`/tables/${data.slug}`, getLocale())}
    gmName={data.account?.username ?? undefined}
    minCapacity={Math.max(1, data.seatsTaken)}
    manageHref={localizedHref(`/tables/${data.slug}/manage`, getLocale())}
    calendarNote
  />

  {#if data.status === 'active'}
    <div class="mt-12 max-w-2xl border-t border-surface-200-800 pt-6">
      <p class="mb-3">{m.form_disable_hint()}</p>
      <ConfirmAction
        action="?/disable"
        label={m.form_disable()}
        title={m.form_disable_confirm_title()}
        text={m.form_disable_confirm_text()}
        class="btn h-12 rounded-lg border-2 border-surface-200-800 px-5 font-semibold text-error-alert hover:preset-tonal"
        success={m.toast_table_disabled()}
      />
    </div>
  {/if}
</section>
