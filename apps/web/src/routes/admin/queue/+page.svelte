<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import UserText from '#lib/components/ui/UserText.svelte';
  import CatalogApprove from './components/CatalogApprove.svelte';
  import CatalogDialog from '../components/CatalogDialog.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { data } = $props();

  const locale = getLocale();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const kindLabel = (kind: 'platform' | 'tag' | 'system' | 'placeTag') =>
    kind === 'platform'
      ? m.admin_kind_platform()
      : kind === 'tag'
        ? m.admin_kind_tag()
        : kind === 'placeTag'
          ? m.admin_kind_place_tag()
          : m.admin_kind_system();
  const decisionText = (decision: (typeof data.decisions)[number]) => {
    const kind = kindLabel(decision.kind).toLowerCase();
    const { name, from, into } = decision;
    switch (decision.type) {
      case 'CatalogEntryCreated':
        return m.admin_decision_created({ name, kind });
      case 'CatalogEntryApproved':
        return m.admin_decision_approved({ name, kind });
      case 'CatalogEntryRejected':
        return m.admin_decision_rejected({ name, kind });
      case 'CatalogEntryRenamed':
        return m.admin_decision_renamed({ from: from ?? '', name, kind });
      case 'CatalogEntryMerged':
        return m.admin_decision_merged({ name, into: into ?? '', kind });
      case 'CatalogEntryDisabled':
        return m.admin_decision_disabled({ name, kind });
    }
  };

  const ghost = 'btn h-11 rounded-lg btn-secondary px-4 font-semibold';
  const primary = 'btn h-11 rounded-lg preset-filled-primary-500 px-5 font-semibold';
  const tonal = 'btn h-11 rounded-lg preset-tonal px-4 font-semibold';
  const danger =
    'btn h-11 rounded-lg px-4 font-semibold text-error-700-300 hover:preset-tonal-error';
</script>

<AdminPage title={m.admin_queue_title()} lede={m.admin_queue_lede()}>
  <div class="mt-8 grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div>
      {#if data.queue.length === 0}
        <p class="rounded-lg border border-surface-200-800 bg-panel p-6" role="status">
          {m.admin_queue_empty()}
        </p>
      {:else}
        <ul class="grid gap-4">
          {#each data.queue as entry (entry.id)}
            {@const candidates = data.approved[entry.kind]}
            <li class="rounded-lg border border-surface-200-800 bg-panel p-5">
              <!-- As on the AdminQueue board: the kind as a pill, then the suggested name itself. -->
              <span
                class="chip h-6 rounded-full border border-surface-200-800 px-3 text-xs font-semibold"
                >{kindLabel(entry.kind)}</span
              >
              <h2 class="mt-3 text-2xl font-semibold">{entry.name}</h2>
              <p class="mt-2 text-sm text-muted">
                {#if entry.suggestedBy}<UserText
                    text={m.admin_queue_suggested_by({ username: entry.suggestedBy })}
                    username={entry.suggestedBy}
                  />{:else}{m.admin_queue_suggested_by_gone()}{/if}
                {m.admin_queue_suggested_on({ date: day.format(entry.createdAt) })}
              </p>
              <p class="mt-3 text-sm">
                {#if entry.tables.length > 0}
                  <span class="font-semibold">{m.admin_queue_used_in()}:</span>
                  {#each entry.tables as table, index (table.slug)}
                    <a href={`/t/${table.slug}`} class="link-underline">{table.title}</a>{index <
                    entry.tables.length - 1
                      ? ', '
                      : ''}
                  {/each}
                {:else if entry.places.length > 0}
                  <span class="font-semibold">{m.admin_queue_used_in()}:</span>
                  {#each entry.places as place, index (place.slug)}
                    <a href={`/pp/${place.slug}`} class="link-underline">{place.name}</a>{index <
                    entry.places.length - 1
                      ? ', '
                      : ''}
                  {/each}
                {:else if entry.kind === 'placeTag'}
                  <span class="text-muted">{m.admin_queue_unused_place()}</span>
                {:else}
                  <span class="text-muted">{m.admin_queue_unused()}</span>
                {/if}
              </p>
              {#if entry.duplicateOf}
                <p
                  role="note"
                  class="mt-3 rounded-lg border border-warning-500 bg-warning-500/10 p-3 text-sm font-semibold"
                >
                  {m.admin_queue_duplicate({ name: entry.duplicateOf.name })}
                </p>
              {/if}
              <div class="mt-4 grid grid-cols-2 items-start gap-3 sm:flex sm:flex-wrap">
                {#if entry.duplicateOf}
                  <CatalogDialog
                    mode="merge"
                    kind={entry.kind}
                    {entry}
                    {candidates}
                    into={entry.duplicateOf.id}
                    label={m.admin_queue_merge_with({ name: entry.duplicateOf.name })}
                    triggerClass={primary}
                  />
                {/if}
                <CatalogApprove
                  kind={entry.kind}
                  id={entry.id}
                  name={entry.name}
                  class={entry.duplicateOf ? ghost : primary}
                />
                <CatalogDialog
                  mode="rename"
                  kind={entry.kind}
                  {entry}
                  label={m.admin_queue_rename()}
                  triggerLabel="{m.admin_queue_rename()}: {entry.name}"
                  triggerClass={ghost}
                />
                {#if !entry.duplicateOf}
                  <CatalogDialog
                    mode="merge"
                    kind={entry.kind}
                    {entry}
                    {candidates}
                    label={m.admin_queue_merge()}
                    triggerLabel="{m.admin_queue_merge()}: {entry.name}"
                    triggerClass={tonal}
                  />
                {/if}
                <CatalogDialog
                  mode="reject"
                  kind={entry.kind}
                  {entry}
                  label={m.admin_queue_reject()}
                  triggerLabel="{m.admin_queue_reject()}: {entry.name}"
                  triggerClass={danger}
                />
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <aside
      aria-labelledby="decisions-title"
      class="h-fit rounded-lg border border-surface-200-800 bg-panel p-5"
    >
      <div class="flex items-baseline justify-between gap-3">
        <h2 id="decisions-title" class="text-lg font-semibold">{m.admin_queue_decisions()}</h2>
        <a
          class="inline-flex min-h-11 items-center anchor text-sm font-semibold"
          href="/admin/audit?kind=catalog">{m.admin_queue_decisions_all()}</a
        >
      </div>
      {#if data.decisions.length === 0}
        <p class="mt-3 text-muted">{m.admin_queue_decisions_empty()}</p>
      {:else}
        <ol class="mt-3 grid gap-3">
          {#each data.decisions as decision (decision.id)}
            <li class="border-l-2 border-surface-200-800 pl-3 text-sm">
              <p class="font-semibold">{decisionText(decision)}</p>
              <p class="text-muted">
                {#if decision.by}<UserText
                    text={m.admin_decision_by({ username: decision.by })}
                    username={decision.by}
                  />{:else}{m.admin_decision_by_gone()}{/if} · {day.format(decision.at)}
              </p>
            </li>
          {/each}
        </ol>
      {/if}
    </aside>
  </div>
</AdminPage>
