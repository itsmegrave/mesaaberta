<script lang="ts">
  // "Sistemas favoritos": the systems the signed-in Início shows tables of, picked by search or from
  // the most played, and whether the public profile shows them as pills.
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import ErrorSummary from '#lib/components/ui/ErrorSummary.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import SettingsSection from '../components/ui/SettingsSection.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { toast } from '#lib/toaster.js';
  import {
    FAVORITE_SYSTEMS_MAX,
    FAVORITE_SYSTEMS_SUGGESTED,
    favoriteSystemsSchema,
    type FavoriteSystemsInput,
  } from '@mesaaberta/core/profile/favorite-systems';
  import { pickName } from '@mesaaberta/core/tables/catalog';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();

  // svelte-ignore state_referenced_locally
  const controller = actionForm<FavoriteSystemsInput>({
    ...fromResult(result?.form ?? data.form),
    schema: favoriteSystemsSchema,
    refresh: false,
    domain: 'account',
    onSuccess: () => {
      controller.markSaved();
      toast.success(m.favorite_systems_saved());
    },
    errorMessage: m.favorite_systems_failed,
  });
  guardDraft(controller);

  const max = FAVORITE_SYSTEMS_MAX;
  const picked = $derived(controller.values.systems);
  const full = $derived(picked.length >= max);
  // The catalog is already most played first.
  const popular = $derived(data.systems.slice(0, FAVORITE_SYSTEMS_SUGGESTED));
  const setSystems = (next: string[]) => controller.change('systems', next);
  const toggle = (slug: string, on: boolean) =>
    setSystems(on ? [...picked, slug] : picked.filter((pick) => pick !== slug));

  const errorText = (code: string | undefined) =>
    code === 'too_many'
      ? m.favorite_systems_too_many({ max })
      : code === 'unknown'
        ? m.favorite_systems_unknown()
        : code
          ? m.favorite_systems_failed()
          : undefined;
  const systemsError = $derived(errorText(controller.errors.systems?.[0]));
  const summary = $derived(
    systemsError ? [{ id: 'systems', label: m.favorite_systems_add(), message: systemsError }] : [],
  );
</script>

<SettingsSection
  title={m.profile_section_systems()}
  lede={m.profile_section_systems_lede({ max })}
/>

<section
  aria-label={m.profile_section_systems()}
  class="rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8"
>
  <MAForm action="?/save" onsubmit={controller.submit} class="grid max-w-2xl gap-6">
    <FormBanner text={controller.errors._errors?.[0]} />
    <ErrorSummary errors={summary} />

    <div>
      <div class="flex items-baseline justify-between gap-3">
        <h3 id="favorite-systems-yours" class="font-semibold">{m.favorite_systems_yours()}</h3>
        <span class="text-sm text-muted" aria-live="polite"
          >{m.favorite_systems_count({ count: picked.length, max })}</span
        >
      </div>
      {#if picked.length === 0}
        <p class="mt-2 text-muted">{m.favorite_systems_empty()}</p>
      {:else}
        <ul aria-labelledby="favorite-systems-yours" class="mt-2 flex flex-wrap gap-2">
          {#each picked as slug (slug)}
            {@const name = pickName(data.systems, slug)}
            <li
              class="inline-flex h-10 items-center gap-1 rounded-full bg-surface-wash pr-1 pl-4 font-semibold"
            >
              {name}
              <MAButton
                size="custom"
                type="button"
                aria-label={m.favorite_systems_remove({ name })}
                onclick={() => toggle(slug, false)}
                class="btn-icon size-8 rounded-full hover:preset-tonal"
              >
                <Icon name="xmark" size={16} />
              </MAButton>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="grid gap-1.5">
      <SearchSelect
        id="systems"
        name="systems"
        label={m.favorite_systems_add()}
        items={data.systems}
        bind:value={() => picked, setSystems}
        multiple
        showPicks={false}
        icon="search"
        placeholder={m.favorite_systems_placeholder()}
        invalid={!!systemsError}
      />
      <p class="text-sm text-muted">{m.favorite_systems_add_hint()}</p>
      <FieldError id="systems" message={systemsError} />
    </div>

    <fieldset>
      <legend class="mb-2 font-semibold">{m.favorite_systems_popular()}</legend>
      <div class="flex flex-wrap gap-2">
        {#each popular as system (system.slug)}
          {@const on = picked.includes(system.slug)}
          <!-- No name: the search box above posts the picks, these only change them. -->
          <label
            class="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-control border-ink-muted px-4 font-semibold has-checked:border-primary-500 has-checked:preset-filled-primary-500 has-focus-visible:outline-4 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500 has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="checkbox"
              class="sr-only"
              checked={on}
              disabled={!on && full}
              onchange={(event) => toggle(system.slug, event.currentTarget.checked)}
            />
            {#if on}<Icon name="check" size={16} />{/if}
            {system.name}
          </label>
        {/each}
      </div>
    </fieldset>

    <Switch
      checked={controller.values.show}
      onCheckedChange={(event) => controller.change('show', event.checked)}
      class="flex items-start justify-between gap-6 border-t border-surface-200-800 pt-4"
    >
      <span>
        <Switch.Label class="block font-semibold">{m.favorite_systems_show()}</Switch.Label>
        <span class="mt-1 block text-sm text-muted">{m.favorite_systems_show_help()}</span>
      </span>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.HiddenInput />
      <input type="hidden" name="show" value={String(controller.values.show)} />
    </Switch>

    <div>
      <MAButton
        type="submit"
        size="custom"
        {controller}
        class="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold sm:w-auto"
      >
        {m.favorite_systems_save()}
      </MAButton>
    </div>
  </MAForm>
</section>
