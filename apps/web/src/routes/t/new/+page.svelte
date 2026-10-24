<script lang="ts">
  import QueryStatus from '#lib/components/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import TableForm from '#lib/components/TableForm.svelte';

  import { m } from '#lib/paraglide/messages.js';
  import { tableFormSchema } from '@mesaaberta/core/tables/schema';

  let { data, form = null } = $props();
  const options = pageQuery(
    () => data.catalogRead ?? { systems: data.systems, catalog: data.catalog },
  );

  const held = $derived(data.duplication?.heldCatalog);
  const withHeld = <T extends { slug: string }>(available: T[], inherited: T[] = []) => [
    ...available,
    ...inherited.filter((item) => !available.some(({ slug }) => slug === item.slug)),
  ];

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

  // `load` makes a new key whenever it runs again. The first one for each source is kept, so a
  // retry after a timeout replays the same copy instead of making another.
  const keys: Record<string, string> = {};
  const requestKey = $derived.by(() => {
    const duplication = data.duplication;
    if (!duplication) return undefined;
    keys[duplication.sourceSlug] ??= duplication.requestKey;
    return keys[duplication.sourceSlug];
  });
</script>

<svelte:head>
  <title>{m.form_new_title()}</title>
</svelte:head>

<QueryStatus failed={options.isError} retry={() => options.refetch()} />

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.nav_my_tables(), href: '/u/tables' }, { label: m.nav_open_table_short() }]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {data.duplication ? m.table_duplicate() : m.form_new_title()}
  </h1>
  <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
    {data.duplication
      ? m.table_duplicate_lede({ title: data.duplication.title })
      : m.form_new_lede()}
  </p>

  <TableForm
    {controller}
    systems={withHeld(options.data?.systems ?? data.systems, held?.systems)}
    catalog={{
      platforms: withHeld((options.data?.catalog ?? data.catalog).platforms, held?.platforms),
      tags: withHeld((options.data?.catalog ?? data.catalog).tags, held?.tags),
    }}
    submitLabel={m.form_submit_new()}
    draftLabel={m.form_submit_draft()}
    suggestSystem
    imageUrl={data.duplication?.imageUrl}
    duplicationRequestKey={requestKey}
    cancelHref={data.duplication ? `/t/${data.duplication.sourceSlug}/manage` : '/t'}
    gmName={data.account?.username ?? undefined}
  />
</section>
