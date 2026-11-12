<script lang="ts">
  import { MATCH_AXES, MATCH_SEEKING, type MatchCardInput } from '@mesaaberta/core/matches/schema';
  import { routes } from '@mesaaberta/core/routes';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import ErrorSummary from '#lib/components/ui/ErrorSummary.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import CheckboxPills from '#lib/components/ui/CheckboxPills.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import MACheckbox from '#lib/components/ui/MACheckbox.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { fieldErrors } from '#lib/forms/field-errors.js';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { errorText, formProblem } from '#lib/tables/form-values.js';
  import { toast } from '#lib/toaster.js';
  import { matchCardSchema } from '@mesaaberta/core/matches/schema';
  import AxisSlider from '../components/ui/AxisSlider.svelte';

  let { data, form = null } = $props();

  // svelte-ignore state_referenced_locally
  const controller = actionForm<MatchCardInput>({
    ...fromResult(form?.form ?? data.form),
    schema: matchCardSchema,
    onSuccess: () => toast.success(m.match_card_saved()),
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);
  const { draft } = controller;

  // Pausar sends the card as it was saved, switched off.
  // svelte-ignore state_referenced_locally
  const pausing = actionForm<MatchCardInput>({
    ...fromResult(data.form),
    schema: matchCardSchema,
    onSuccess: () => toast.success(m.match_card_paused()),
    errorMessage: m.form_error_unavailable,
  });
  // svelte-ignore state_referenced_locally
  const saved = data.form.data;

  const codes: Record<string, () => string> = {
    adult_required: m.match_err_adult_required,
    adult_only: m.match_err_adult_only,
    seeking_required: m.match_err_seeking_required,
    format_required: m.match_err_format_required,
    city_required: m.match_err_city_required,
  };
  const say = (code: string | undefined, field = '') =>
    code ? (codes[code]?.() ?? errorText(code, field)) : undefined;
  const errors = fieldErrors<keyof MatchCardInput>(controller, say);
  const { err } = errors;
  const problems = $derived(
    errors.summary([
      ['seeking', m.match_card_seeking()],
      ['online', m.match_card_format()],
      ['inPerson', m.match_card_format()],
      ['adult', m.match_card_adult_title()],
    ]),
  );
  const banner = $derived(formProblem(controller.message));

  const seeking = $derived(
    MATCH_SEEKING.map((value) => ({
      value,
      label: {
        players: m.match_seeking_players,
        gm: m.match_seeking_gm,
        group: m.match_seeking_group,
      }[value](),
    })),
  );
  const formatError = $derived(err('online') ?? err('inPerson'));
</script>

<svelte:head><title>{m.match_card_title()} · Mesa Aberta</title></svelte:head>

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.nav_matches(), href: routes.matches }, { label: m.match_card_title() }]}
  />
  <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
    {m.match_card_title()}
  </h1>
  <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
    {m.match_card_lede()}
  </p>

  {#if data.hasCard && !data.enabled}
    <p class="mt-6 max-w-2xl rounded-lg bg-surface-wash p-4 font-semibold" role="status">
      {m.match_card_paused_note()}
    </p>
  {/if}

  <MAForm
    action="?/save"
    onsubmit={controller.submit}
    onfocusout={controller.blur}
    class="mt-8 grid max-w-2xl gap-8"
  >
    <ErrorSummary errors={problems} />
    <FormBanner text={banner} />

    <FormSection step={1} title={m.match_card_seeking()} hint={m.match_card_seeking_hint()}>
      <CheckboxPills
        name="seeking"
        legend={m.match_card_seeking_legend()}
        options={seeking}
        bind:group={$draft.seeking}
        error={err('seeking')}
      />
    </FormSection>

    <FormSection step={2} title={m.match_card_format()} hint={m.match_card_format_hint()}>
      <fieldset class="grid gap-1" aria-describedby={formatError ? 'online-error' : undefined}>
        <legend class="sr-only">{m.match_card_format()}</legend>
        <MACheckbox name="online" value="true" bind:checked={$draft.online}>
          {m.match_format_online()}
        </MACheckbox>
        <MACheckbox
          name="inPerson"
          value="true"
          bind:checked={$draft.inPerson}
          aria-describedby="inPerson-hint"
        >
          {m.match_format_in_person()}
        </MACheckbox>
        <p id="inPerson-hint" class="text-sm text-muted">
          {data.state.city ? m.match_card_city({ city: data.state.city }) : m.match_card_no_city()}
          <a class="anchor" href={routes.editProfile}>{m.match_card_edit_profile()}</a>
        </p>
        <FieldError id="online" class="" message={formatError} />
      </fieldset>
    </FormSection>

    <FormSection step={3} title={m.match_card_style()} hint={m.match_card_style_hint()}>
      <div class="grid gap-6">
        {#each MATCH_AXES as { key } (key)}
          <AxisSlider axis={key} bind:value={$draft[key]} />
        {/each}
      </div>
    </FormSection>

    <FormSection step={4} title={m.match_card_adult_title()}>
      <div class="grid gap-3">
        <p class="text-sm text-muted">
          {m.match_card_rules_note()}
          <a class="anchor" href={routes.community}>{m.match_card_rules_link()}</a>
        </p>
        <MACheckbox
          name="adult"
          value="true"
          align="start"
          bind:checked={$draft.adult}
          aria-invalid={err('adult') ? 'true' : undefined}
          aria-describedby={err('adult') ? 'adult-error' : undefined}
        >
          {m.match_card_adult()}
        </MACheckbox>
        <FieldError id="adult" class="" message={err('adult')} />
      </div>
    </FormSection>

    <p class="text-sm text-muted">
      {m.match_card_profile_facts({
        systems: data.state.favoriteSystems,
        slots: data.state.availabilitySlots,
      })}
    </p>

    <div class="flex flex-wrap items-center gap-5">
      <MAButton type="submit" variant="primary" {controller}>
        {data.hasCard && data.enabled ? m.match_card_save() : m.match_card_start()}
      </MAButton>
      <a href={routes.matches} class="{buttonClass('secondary', 'md')} font-semibold"
        >{m.form_cancel()}</a
      >
    </div>
  </MAForm>

  {#if data.hasCard && data.enabled}
    <MAForm
      action="?/pause"
      onsubmit={pausing.submit}
      class="mt-10 grid max-w-2xl gap-3 border-t border-surface-200-800 pt-6"
    >
      <h2 class="text-lg font-semibold">{m.match_card_pause_title()}</h2>
      <p class="text-sm text-muted">{m.match_card_pause_hint()}</p>
      {#each saved.seeking as value (value)}
        <input type="hidden" name="seeking" {value} />
      {/each}
      <input type="hidden" name="online" value={String(saved.online)} />
      <input type="hidden" name="inPerson" value={String(saved.inPerson)} />
      <input type="hidden" name="adult" value="true" />
      {#each MATCH_AXES as { key } (key)}
        <input type="hidden" name={key} value={saved[key]} />
      {/each}
      <div>
        <MAButton type="submit" variant="danger" controller={pausing}>
          {m.match_card_pause()}
        </MAButton>
      </div>
    </MAForm>
  {/if}
</section>
