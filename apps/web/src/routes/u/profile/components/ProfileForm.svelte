<script lang="ts">
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import NetworkLinksField from '#lib/components/ui/NetworkLinksField.svelte';
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { createQuery } from '@tanstack/svelte-query';
  import { queryClient } from '#lib/query/context.js';
  import { usernameAvailability } from '#lib/query/lookups.js';
  const client = queryClient();
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import {
    AGE_RANGES,
    GENDER_OPTIONS,
    profileSchema,
    PROFILE_LIMITS,
    type AgeRange,
    type Gender,
    type ProfileInput,
  } from '@mesaaberta/core/profile/schema';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import type { FormResult } from '#lib/forms/contract.js';
  import { fieldErrors, problem, type Problem } from '#lib/forms/field-errors.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import ErrorSummary from '#lib/components/ui/ErrorSummary.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import { timezoneOptions } from '@mesaaberta/core/time/timezone';
  import { onMount } from 'svelte';
  import { m } from '#lib/paraglide/messages.js';
  import type { ProfileSection } from '#lib/profile/sections.js';
  import {
    MAX_SOCIAL_LINKS,
    NETWORKS,
    takesHandle,
    type Network,
  } from '@mesaaberta/core/profile/social-links';
  import {
    MAX_USERNAME_LENGTH,
    normalizeUsername,
    usernameProblem,
  } from '@mesaaberta/core/profile/username';

  /** What the server says about a username: free, taken, or not acceptable at all. */
  export type Availability = 'free' | 'taken' | 'invalid';

  type Props = {
    form: FormResult<ProfileInput>;
    action?: string;
    /** On the profile page the username is shown but cannot change: it was chosen at onboarding. */
    usernameLocked?: boolean;
    /**
     * Which fields it shows: all of them when the profile is first filled in, or one part of
     * "Editar perfil" (the server keeps the stored value of every field a part doesn't send).
     */
    section?: 'all' | ProfileSection;
    submitLabel?: string;
    /** Where "Cancelar" goes: the page the person came from. Without it there is no Cancelar. */
    cancelHref?: string;
    /** Called after a save that stays on the page (the profile page), to confirm it. */
    onsaved?: () => void;
    /** Asks the server if a (well formed) username is free. Replaced in tests. */
    checkUsername?: (username: string, signal: AbortSignal) => Promise<Availability>;
  };

  let {
    form: initial,
    action,
    usernameLocked: locked = false,
    section = 'all',
    submitLabel,
    cancelHref,
    onsaved,
    checkUsername = usernameAvailability,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    initial: initial.data,
    initialErrors: initial.errors,
    schema: profileSchema,
    domain: 'account',
    errorMessage: m.profile_error_form,
    onSuccess() {
      controller.markSaved();
      onsaved?.();
    },
  });
  const { draft } = controller;
  guardDraft(controller);

  const shows = (part: ProfileSection) => section === 'all' || section === part;
  // A part of "Editar perfil" never sends the username, so it is never checked there.
  const usernameLocked = $derived(locked || section !== 'all');

  // Not picked yet: offer the browser's zone, so saving the form keeps it on the profile. It is an
  // offer, not an edit: untainted, so leaving the page does not ask about unsaved changes.
  // Set once JavaScript runs: until then every field is shown, "Outro"'s own words included.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
    if ($draft.timezone || !shows('about')) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    controller.reset({ ...controller.values, timezone }, { preserveErrors: true });
  });
  const timezones = timezoneOptions();

  const AGE_RANGE_LABELS: Record<AgeRange, () => string> = {
    '13_17': m.profile_age_range_13_17,
    '18_24': m.profile_age_range_18_24,
    '25_34': m.profile_age_range_25_34,
    '35_44': m.profile_age_range_35_44,
    '45_54': m.profile_age_range_45_54,
    '55_plus': m.profile_age_range_55_plus,
  };

  const GENDER_LABELS: Record<Gender, () => string> = {
    woman: m.profile_gender_woman,
    man: m.profile_gender_man,
    trans_woman: m.profile_gender_trans_woman,
    trans_man: m.profile_gender_trans_man,
    non_binary: m.profile_gender_non_binary,
    agender: m.profile_gender_agender,
    genderfluid: m.profile_gender_genderfluid,
    travesti: m.profile_gender_travesti,
    other: m.profile_gender_other,
  };

  // What "Prefiro não informar" stands for in the list: the form sends nothing for it.
  const NO_ANSWER = '__none';
  const ageItems = AGE_RANGES.map((range) => ({ name: AGE_RANGE_LABELS[range](), slug: range }));
  const genderItems = GENDER_OPTIONS.map((option) => ({
    name: GENDER_LABELS[option](),
    slug: option,
  }));

  const input = 'input h-13 w-full rounded-lg border-control border-ink-muted bg-panel px-3';
  const secondary =
    'btn h-12 min-w-11 rounded-lg btn-secondary px-3 font-semibold disabled:opacity-50';

  const ERRORS: Record<string, () => string> = {
    required: m.profile_error_required,
    too_short: m.profile_error_too_short,
    too_long: m.profile_error_too_long,
    invalid_chars: m.profile_error_invalid_chars,
    hyphen_edges: m.profile_error_hyphen_edges,
    hyphen_double: m.profile_error_hyphen_double,
    reserved: m.profile_error_reserved,
    taken: m.profile_error_taken,
    invalid_url: m.profile_error_invalid_url,
    invalid_handle: m.profile_error_invalid_handle,
    invalid_network: m.profile_error_invalid_network,
    duplicate: m.profile_error_duplicate,
    too_many: m.profile_error_too_many,
  };
  const errorText = (code: string | undefined) =>
    code ? (ERRORS[code] ?? m.profile_error_invalid)() : undefined;
  const errors = fieldErrors<keyof ProfileInput>(controller, (code) => errorText(code));
  const { err } = errors;

  const NETWORK_LABELS: Record<Network, () => string> = {
    instagram: m.network_instagram,
    x: m.network_x,
    bluesky: m.network_bluesky,
    facebook: m.network_facebook,
    tiktok: m.network_tiktok,
    youtube: m.network_youtube,
    twitch: m.network_twitch,
    discord: m.network_discord,
    github: m.network_github,
    linkedin: m.network_linkedin,
    website: m.network_website,
  };

  const rowErrors = (index: number) => ({
    url: errorText(controller.errors[`linkUrl.${index}`]?.[0]),
    network: errorText(controller.errors[`linkNetwork.${index}`]?.[0]),
  });
  const networkItems = NETWORKS.map((network) => ({
    name: NETWORK_LABELS[network](),
    slug: network,
  }));

  // --- the username, checked against the server while it is typed --------------------------------

  let checkedUsername = $state('');
  const normalized = $derived(normalizeUsername($draft.username));
  $effect(() => {
    const value = normalized;
    checkedUsername = '';
    if (usernameLocked || usernameProblem(value) !== null) return;
    const timer = setTimeout(() => {
      checkedUsername = value;
    }, 400);
    return () => clearTimeout(timer);
  });
  const availabilityQuery = createQuery(
    () => ({
      queryKey: ['api', 'username', page.data.cacheIdentity ?? 'anonymous', checkedUsername],
      queryFn: ({ signal }) => checkUsername(checkedUsername, signal),
      enabled:
        browser && !usernameLocked && checkedUsername !== '' && checkedUsername === normalized,
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
    }),
    () => client,
  );
  const availability = $derived(
    usernameLocked || usernameProblem(normalized) !== null
      ? 'idle'
      : checkedUsername !== normalized || availabilityQuery.isFetching
        ? 'checking'
        : availabilityQuery.isError
          ? 'failed'
          : (availabilityQuery.data ?? 'checking'),
  );

  const usernameError = $derived(
    err('username') ?? (availability === 'taken' ? m.profile_error_taken() : undefined),
  );

  // Each invalid field, in the order the form asks for them, for the summary at the top.
  const summary = $derived(
    [
      ...(usernameLocked ? [] : [problem('username', m.profile_username(), usernameError)]),
      ...errors.summary([
        ['name', m.profile_name()],
        ['bio', m.profile_bio()],
        ['ageRange', m.profile_age_range(), 'age-range'],
        ['gender', m.profile_gender()],
        ['genderOther', m.profile_gender_other_label(), 'gender-other'],
        ['city', m.profile_city()],
        ['timezone', m.profile_timezone()],
      ]),
    ].filter((entry): entry is Problem => !!entry),
  );
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and show validation in the same translated messages as the server. -->
<MAForm
  {action}
  onsubmit={controller.submit}
  onfocusout={controller.blur}
  class="grid max-w-xl gap-6"
>
  <ErrorSummary errors={summary} />

  {#if section === 'all'}<FormField
      id="username"
      label={m.profile_username()}
      hint={usernameLocked ? m.profile_username_locked_hint() : m.profile_username_hint()}
      error={usernameLocked ? undefined : usernameError}
    >
      {#snippet children(aria)}
        <TextInput
          id="username"
          name="username"
          type="text"
          aria-required="true"
          maxlength={MAX_USERNAME_LENGTH}
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          bind:value={$draft.username}
          readonly={usernameLocked}
          class="{input} {usernameLocked ? 'bg-surface-950-50/5 text-muted' : ''}"
          {...aria}
          aria-describedby={aria['aria-invalid']
            ? aria['aria-describedby']
            : `${aria['aria-describedby']} username-status`}
        />
        <!-- Announced politely as the check finishes; it never blocks the form. -->
        <p
          id="username-status"
          role="status"
          class="mt-1 text-sm {usernameLocked ? 'sr-only' : 'min-h-6'}"
        >
          {#if availability === 'checking'}
            {m.profile_username_checking()}
          {:else if availability === 'free'}
            {m.profile_username_free()}
          {:else if availability === 'failed'}
            {m.profile_username_check_failed()}
          {/if}
        </p>
      {/snippet}
    </FormField>{/if}

  {#if shows('public')}
    <FormField
      id="name"
      label={m.profile_name()}
      hint={m.profile_name_hint()}
      optional
      counter={{ count: $draft.name.length, max: PROFILE_LIMITS.name }}
      error={err('name')}
    >
      {#snippet children(aria)}
        <TextInput
          id="name"
          name="name"
          type="text"
          maxlength={PROFILE_LIMITS.name}
          autocomplete="name"
          bind:value={$draft.name}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    {#if section === 'public'}
      <!-- Off until the person turns it on: the name may have come from Google or Discord. -->
      <label class="-mt-2 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="showName"
          value="true"
          bind:checked={$draft.showName}
          class="checkbox"
        />
        {m.profile_show_name()}
      </label>
    {/if}
  {/if}

  {#if section === 'public'}
    <!-- Plain text: the public profile keeps its line breaks and nothing else. -->
    <FormField
      id="bio"
      label={m.profile_bio()}
      hint={m.profile_bio_hint()}
      optional
      counter={{ count: $draft.bio.length, max: PROFILE_LIMITS.bio }}
      error={err('bio')}
    >
      {#snippet children(aria)}
        <MATextArea
          id="bio"
          name="bio"
          rows={4}
          maxlength={PROFILE_LIMITS.bio}
          bind:value={$draft.bio}
          class="textarea w-full rounded-lg border-control border-ink-muted bg-panel p-3"
          {...aria}
        />
      {/snippet}
    </FormField>
  {/if}

  {#if shows('about')}
    <div class="grid gap-6 sm:grid-cols-2">
      {#each [{ id: 'age-range', field: 'ageRange', label: m.profile_age_range(), none: m.profile_age_range_none(), items: ageItems }, { id: 'gender', field: 'gender', label: m.profile_gender(), none: m.profile_gender_none(), items: genderItems }] as const as picker (picker.id)}
        <div class="min-w-0">
          <!-- The same combobox as the timezone. "Prefiro não informar" clears it. -->
          <SearchSelect
            id={picker.id}
            name={picker.field}
            label="{picker.label} ({m.form_optional()})"
            labelClass="label-text block font-semibold"
            class="grid gap-1"
            items={[{ name: picker.none, slug: NO_ANSWER }, ...picker.items]}
            value={$draft[picker.field] ? [$draft[picker.field]] : []}
            placeholder={picker.none}
            invalid={!!errors.invalid(picker.field)}
            onchange={(picked) =>
              ($draft[picker.field] = (
                picked.at(-1) === NO_ANSWER ? '' : (picked.at(-1) ?? '')
              ) as never)}
          />
          <FieldError id={picker.id} message={err(picker.field)} />
        </div>
      {/each}
    </div>

    <!-- Own words for "Outro". Without JavaScript the field is always there (the server keeps it
       only with "Outro"); with it, the field shows once "Outro" is picked. -->
    {#if !mounted || $draft.gender === 'other'}
      <FormField
        id="gender-other"
        label={m.profile_gender_other_label()}
        hint={m.profile_gender_other_hint()}
        error={err('genderOther')}
      >
        {#snippet children(aria)}
          <TextInput
            id="gender-other"
            name="genderOther"
            type="text"
            maxlength={PROFILE_LIMITS.gender}
            bind:value={$draft.genderOther}
            class={input}
            {...aria}
          />
        {/snippet}
      </FormField>
    {/if}

    <FormField id="city" label={m.profile_city()} optional error={err('city')}>
      {#snippet children(aria)}
        <TextInput
          id="city"
          name="city"
          type="text"
          maxlength={PROFILE_LIMITS.city}
          autocomplete="address-level2"
          bind:value={$draft.city}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>

    <div class="min-w-0">
      <SearchSelect
        id="timezone"
        name="timezone"
        label={m.profile_timezone()}
        labelClass="label-text block font-semibold"
        class="grid gap-1"
        items={timezones}
        value={$draft.timezone ? [$draft.timezone] : []}
        placeholder={m.profile_timezone_placeholder()}
        invalid={!!errors.invalid('timezone')}
        onchange={(picked) => ($draft.timezone = picked[0] ?? '')}
      />
      <p id="timezone-hint" class="mt-1 text-sm text-surface-700-300">
        {m.profile_timezone_hint()}
      </p>
      <FieldError id="timezone" message={err('timezone')} />
    </div>
  {/if}

  {#if shows('public')}
    <NetworkLinksField
      bind:networks={$draft.linkNetwork}
      bind:urls={$draft.linkUrl}
      items={networkItems}
      max={MAX_SOCIAL_LINKS}
      idPrefix="link"
      legend={m.profile_links()}
      hint={m.profile_links_hint()}
      empty={m.profile_links_empty()}
      reorder
      error={err('linkUrl')}
      {rowErrors}
      placeholder={(network) =>
        takesHandle(network as Network) ? m.profile_link_handle_placeholder() : 'https://'}
      inputmode={(network) => (takesHandle(network as Network) ? 'text' : 'url')}
      labels={{
        network: (n) => m.profile_link_network({ n }),
        url: (n, network) =>
          takesHandle(network as Network)
            ? m.profile_link_handle({ n })
            : m.profile_link_url({ n }),
        remove: (n) => m.profile_link_remove({ n }),
        up: (n) => m.profile_link_up({ n }),
        down: (n) => m.profile_link_down({ n }),
        add: m.profile_link_add(),
        removed: m.profile_link_removed,
        moved: (n, position) => m.profile_link_moved({ n, position }),
      }}
      inputClass={input}
      buttonClass={secondary}
    />
  {/if}

  <div class="flex flex-wrap items-center gap-5">
    <MAButton
      type="submit"
      size="custom"
      {controller}
      class="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold sm:w-auto"
    >
      {submitLabel ?? m.profile_submit()}
    </MAButton>
    {#if cancelHref}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
      <a href={cancelHref} class="{buttonClass('secondary', 'md')} font-semibold"
        >{m.form_cancel()}</a
      >
    {/if}
  </div>
</MAForm>
