<script lang="ts">
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { guardDraft } from '$lib/forms/guard.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import TableForm from '$lib/components/TableForm.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';
  import { tableFormSchema } from '$lib/tables/schema';

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
    onSuccess: () => {},
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);
</script>

<svelte:head>
  <title>{m.form_new_title()}</title>
</svelte:head>

<QueryStatus failed={options.isError} retry={() => options.refetch()} />

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[
      { label: m.nav_my_tables(), href: '/account/tables' },
      { label: m.nav_open_table_short() },
    ]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.form_new_title()}
  </h1>
  <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
    {m.form_new_lede()}
  </p>

  <TableForm
    {controller}
    systems={options.data?.systems ?? data.systems}
    catalog={options.data?.catalog ?? data.catalog}
    submitLabel={m.form_submit_new()}
    cancelHref={localizedHref('/tables', getLocale())}
    gmName={data.account?.username ?? undefined}
  />
</section>
