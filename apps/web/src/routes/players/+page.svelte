<script lang="ts">
  import { goto } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import DirectoryFilters from '#lib/components/directory/DirectoryFilters.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MACheckbox from '#lib/components/ui/MACheckbox.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import {
    LOOKING_NOTE_MAX,
    lookingSchema,
    playerQuery,
    type PlayerFilters,
  } from '@mesaaberta/core/players/looking';
  import PlayerCard from './components/ui/PlayerCard.svelte';
  import { playerFacts } from './components/player-card';

  let { data, form: result = null } = $props();
  const filters = $derived(data.filters);
  const now = new Date();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  // A new filter starts over on the first page.
  const apply = (change: Partial<Omit<PlayerFilters, 'page'>>) =>
    goto(`/players${playerQuery({ ...filters, ...change })}`, { reset: false });

  const ANY_SYSTEM = 'all';
  const systemItems = $derived([
    { slug: ANY_SYSTEM, name: m.gms_system_any() },
    ...data.systems.map((system) => ({ slug: system.slug, name: system.name })),
  ]);
  const filtered = $derived(!!(filters.query || filters.system));

  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    ...fromResult(result?.form ?? data.form),
    schema: lookingSchema,
    errorMessage: m.form_error_invalid,
    onSuccess() {
      toast.success($draft.looking ? m.players_looking_saved_on() : m.players_looking_saved_off());
    },
  });
  const { draft } = controller;
  const noteError = $derived(
    controller.errors.note
      ? controller.errors.note[0] === 'too_long'
        ? m.form_error_too_big()
        : m.form_error_invalid()
      : undefined,
  );
</script>

<section class="py-2 md:pt-12">
  <PageHead
    crumbs={[{ label: m.players_crumb() }]}
    title={m.players_title()}
    lede={m.players_lede()}
  />

  <MAForm
    action="?/looking"
    onsubmit={controller.submit}
    class="mt-6 grid gap-4 rounded-lg border border-surface-200-800 bg-panel p-5 md:mt-8"
    aria-labelledby="players-me"
  >
    <div>
      <h2 id="players-me" class="text-lg font-semibold">{m.players_me_title()}</h2>
      <p class="mt-1 text-sm text-muted">
        {data.me.looking ? m.players_me_listed() : m.players_me_hint()}
      </p>
    </div>
    <MACheckbox name="looking" value="true" bind:checked={$draft.looking}>
      <span class="font-semibold">{m.players_me_looking()}</span>
    </MACheckbox>
    <FormField
      id="players-note"
      label={m.players_me_note()}
      hint={m.players_me_note_hint()}
      optional
      counter={{ count: $draft.note.length, max: LOOKING_NOTE_MAX }}
      error={noteError}
    >
      {#snippet children(control)}
        <MATextArea
          id="players-note"
          name="note"
          rows={2}
          maxlength={LOOKING_NOTE_MAX}
          bind:value={$draft.note}
          {...control}
        />
      {/snippet}
    </FormField>
    <FieldError id="players-me" message={controller.errors._errors?.[0]} />
    <div>
      <MAButton type="submit" {controller}>{m.players_me_save()}</MAButton>
    </div>
  </MAForm>

  <DirectoryFilters
    id="players"
    query={filters.query}
    searchLabel={m.players_search_label()}
    result={m.players_found({ count: data.total })}
    note={m.players_found_hint()}
    onapply={(change) => void apply(change)}
  >
    {#snippet controls()}
      <SearchSelect
        id="players-system"
        name="system"
        label={m.gms_system_label()}
        labelClass="sr-only"
        class="w-full md:w-60"
        compact
        items={systemItems}
        value={[filters.system || ANY_SYSTEM]}
        placeholder={m.gms_system_label()}
        onchange={(next) => {
          const slug = next[0] ?? ANY_SYSTEM;
          void apply({ system: slug === ANY_SYSTEM ? '' : slug });
        }}
      />
    {/snippet}
  </DirectoryFilters>

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.people.length > 0}
    <CardGrid>
      {#each data.people as player (player.username)}
        <li class="min-w-0">
          <PlayerCard {player} facts={playerFacts(player, now)} />
        </li>
      {/each}
    </CardGrid>
    <div class="mt-8">
      <Pager
        page={filters.page}
        pages={data.pages}
        compact
        href={(number) => `/players${playerQuery(filters, number)}`}
      />
    </div>
  {:else if filtered}
    <DirectoryEmpty
      class="mt-2"
      title={m.players_empty_filtered()}
      hint={m.gms_empty_filtered_hint()}
      href="/players"
      action={m.gms_clear_filters()}
    />
  {:else}
    <DirectoryEmpty class="mt-2" title={m.players_empty()} hint={m.players_empty_hint()} />
  {/if}
</section>
