<script lang="ts">
  // In place of "Dos seus sistemas" while there are no favorites: the most played systems as pills,
  // saved through Editar perfil's own action, so a new member sets them in one step.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import CheckboxPills from '#lib/components/ui/CheckboxPills.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { toast } from '#lib/toaster.js';
  import {
    FAVORITE_SYSTEMS_MAX,
    FAVORITE_SYSTEMS_SUGGESTED,
    favoriteSystemsSchema,
    type FavoriteSystemsInput,
  } from '@mesaaberta/core/profile/favorite-systems';
  import { m } from '#lib/paraglide/messages.js';

  let { systems, show }: { systems: { name: string; slug: string }[]; show: boolean } = $props();

  const max = FAVORITE_SYSTEMS_MAX;
  // svelte-ignore state_referenced_locally
  const controller = actionForm<FavoriteSystemsInput>({
    initial: { systems: [], show },
    schema: favoriteSystemsSchema,
    domain: 'account',
    onSuccess: () => toast.success(m.favorite_systems_saved()),
    errorMessage: m.favorite_systems_failed,
  });

  const options = $derived(
    systems
      .slice(0, FAVORITE_SYSTEMS_SUGGESTED)
      .map((system) => ({ value: system.slug, label: system.name })),
  );
  let picked = $state<string[]>([]);
  // The pills hold the choice; the form gets it as it is sent.
  const submit = (event: SubmitEvent) => {
    controller.change('systems', picked);
    return controller.submit(event);
  };
  const error = $derived(
    controller.errors.systems?.[0] === 'too_many'
      ? m.favorite_systems_too_many({ max })
      : undefined,
  );
</script>

<section
  aria-labelledby="home-picker"
  class="rounded-lg border border-surface-200-800 bg-panel p-5 md:p-8"
>
  <h2 id="home-picker" class="text-2xl font-semibold tracking-tight md:text-3xl">
    {m.home_picker_title()}
  </h2>
  <p class="mt-2 max-w-xl text-muted">{m.home_picker_lede({ max })}</p>
  <MAForm action="/u/profile/edit/systems?/save" onsubmit={submit} class="mt-5 grid gap-4">
    <FormBanner text={controller.errors._errors?.[0]} />
    <CheckboxPills
      name="systems"
      legend={m.home_picker_legend()}
      {options}
      bind:group={picked}
      {error}
    />
    <input type="hidden" name="show" value={String(show)} />
    <div class="flex flex-wrap items-center gap-4">
      <MAButton type="submit" variant="primary" {controller} class="font-semibold">
        {m.favorite_systems_save()}
      </MAButton>
      <span class="text-sm text-muted" aria-live="polite"
        >{m.home_picker_count({ count: picked.length, max })}</span
      >
    </div>
  </MAForm>
</section>
