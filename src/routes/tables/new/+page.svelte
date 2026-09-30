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
  import TableForm from '$lib/components/TableForm.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';
  import { tableFormSchema } from '$lib/tables/schema';

  let { data } = $props();
  const options = pageQuery(
    () => data.catalogRead ?? { systems: data.systems, catalog: data.catalog },
  );

  // svelte-ignore state_referenced_locally
  const superform = superForm(data.form, {
    validators: zod4Client(tableFormSchema),
    onResult: ({ result }) => {
      if (result.type === 'redirect') void afterWrite(client, 'table');
    },
    // A table form is long: leaving it with changes asks first.
    taintedMessage: confirmLeave,
  });
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
    {superform}
    systems={options.data?.systems ?? data.systems}
    catalog={options.data?.catalog ?? data.catalog}
    submitLabel={m.form_submit_new()}
    cancelHref={localizedHref('/tables', getLocale())}
    gmName={data.account?.username ?? undefined}
  />
</section>
