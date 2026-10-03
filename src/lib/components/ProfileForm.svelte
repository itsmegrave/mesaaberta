<script lang="ts">
  import TextInput from '$lib/components/TextInput.svelte';
  import SelectInput from '$lib/components/SelectInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { createQuery } from '@tanstack/svelte-query';
  import { queryClient } from '$lib/query/context';
  import { usernameAvailability } from '$lib/query/lookups';
  const client = queryClient();
  import { guardDraft } from '$lib/forms/guard.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { tick } from 'svelte';
  import {
    AGE_RANGES,
    GENDER_OPTIONS,
    profileSchema,
    PROFILE_LIMITS,
    type AgeRange,
    type Gender,
    type ProfileInput,
  } from '$lib/profile/schema';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import type { FormResult } from '$lib/forms/contract';
  import Form from './Form.svelte';
  import FormField from './FormField.svelte';
  import ErrorSummary from './ErrorSummary.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import { timezoneOptions } from '$lib/time/timezone';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages';
  import { MAX_SOCIAL_LINKS, NETWORKS, type Network } from '$lib/profile/social-links';
  import { MAX_USERNAME_LENGTH, normalizeUsername, usernameProblem } from '$lib/profile/username';

  /** What the server says about a username: free, taken, or not acceptable at all. */
  export type Availability = 'free' | 'taken' | 'invalid';

  type Props = {
    form: FormResult<ProfileInput>;
    action?: string;
    /** On the profile page the username is shown but cannot change: it was chosen at onboarding. */
    usernameLocked?: boolean;
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
    usernameLocked = false,
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

  // Not picked yet: offer the browser's zone, so saving the form keeps it on the profile. It is an
  // offer, not an edit: untainted, so leaving the page does not ask about unsaved changes.
  // Set once JavaScript runs: until then every field is shown, "Outro"'s own words included.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
    if ($draft.timezone) return;
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

  const input = 'input h-12 w-full rounded-lg border-surface-200-800 bg-panel px-3';
  // The network of a link stays a native select (the row has no room for a list).
  const select = 'select h-12 w-full rounded-lg border-surface-200-800 bg-panel px-3';
  const secondary =
    'btn h-12 min-w-11 rounded-lg border-2 border-surface-200-800 px-3 font-semibold hover:preset-tonal disabled:opacity-50';

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
    invalid_network: m.profile_error_invalid_network,
    duplicate: m.profile_error_duplicate,
    too_many: m.profile_error_too_many,
  };
  const errorText = (code: string | undefined) =>
    code ? (ERRORS[code] ?? m.profile_error_invalid)() : undefined;

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

  const itemError = (field: 'linkNetwork' | 'linkUrl', index: number) =>
    errorText(controller.errors[`${field}.${index}`]?.[0]);
  const listError = () => errorText(controller.errors.linkUrl?.[0]);

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
    errorText(controller.errors.username?.[0]) ??
      (availability === 'taken' ? m.profile_error_taken() : undefined),
  );
  const usernameDescription = $derived(
    ['username-hint', usernameError ? 'username-error' : 'username-status'].join(' '),
  );

  // Each invalid field, in the order the form asks for them, for the summary at the top.
  const summary = $derived(
    (
      [
        ['username', m.profile_username(), usernameLocked ? undefined : usernameError],
        ['name', m.profile_name(), errorText(controller.errors.name?.[0])],
        ['age-range', m.profile_age_range(), errorText(controller.errors.ageRange?.[0])],
        ['gender', m.profile_gender(), errorText(controller.errors.gender?.[0])],
        [
          'gender-other',
          m.profile_gender_other_label(),
          errorText(controller.errors.genderOther?.[0]),
        ],
        ['city', m.profile_city(), errorText(controller.errors.city?.[0])],
        ['timezone', m.profile_timezone(), errorText(controller.errors.timezone?.[0])],
      ] as const
    ).flatMap(([id, label, message]) => (message ? [{ id, label, message }] : [])),
  );

  // --- the links: a list to add to, remove from and reorder -------------------------------------

  // Each row keeps an id of its own, so a row that moves keeps what was typed in it and its focus.
  let nextId = 0;
  let ids = $state($draft.linkNetwork.map(() => nextId++));
  let announcement = $state('');
  let addButton: HTMLButtonElement | undefined = $state();

  const canAdd = $derived(ids.length < MAX_SOCIAL_LINKS);

  function addLink() {
    $draft.linkNetwork = [...$draft.linkNetwork, 'instagram'];
    $draft.linkUrl = [...$draft.linkUrl, ''];
    const id = nextId++;
    ids.push(id);

    tick().then(() => document.getElementById(`link-url-${id}`)?.focus());
  }

  function removeLink(index: number) {
    $draft.linkNetwork = $draft.linkNetwork.filter((_, i) => i !== index);
    $draft.linkUrl = $draft.linkUrl.filter((_, i) => i !== index);
    ids.splice(index, 1);
    announcement = m.profile_link_removed();

    // The row that had the focus is gone: keep the focus in the list.
    tick().then(() => addButton?.focus());
  }

  function moveLink(index: number, by: -1 | 1) {
    const to = index + by;
    const swap = <T,>(list: T[]) => {
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    };

    $draft.linkNetwork = swap($draft.linkNetwork);
    $draft.linkUrl = swap($draft.linkUrl);
    ids = swap(ids);
    announcement = m.profile_link_moved({ n: index + 1, position: to + 1 });
  }
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and show validation in the same translated messages as the server. -->
<Form
  {action}
  onsubmit={controller.submit}
  onfocusout={controller.blur}
  class="grid max-w-xl gap-6"
>
  <ErrorSummary errors={summary} />

  <FormField
    id="username"
    label={m.profile_username()}
    hint={usernameLocked ? m.profile_username_locked_hint() : m.profile_username_hint()}
    error={usernameLocked ? undefined : usernameError}
  >
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
      aria-invalid={usernameError ? 'true' : undefined}
      aria-describedby={usernameDescription}
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
  </FormField>

  <FormField
    id="name"
    label={m.profile_name()}
    hint={m.profile_name_hint()}
    optional
    counter={{ count: $draft.name.length, max: PROFILE_LIMITS.name }}
    error={errorText(controller.errors.name?.[0])}
  >
    <TextInput
      id="name"
      name="name"
      type="text"
      maxlength={PROFILE_LIMITS.name}
      autocomplete="name"
      bind:value={$draft.name}
      class={input}
      aria-invalid={controller.errors.name ? 'true' : undefined}
      aria-describedby="name-hint{controller.errors.name ? ' name-error' : ''}"
    />
  </FormField>

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
          invalid={Boolean(controller.errors[picker.field])}
          onchange={(picked) =>
            ($draft[picker.field] = (
              picked.at(-1) === NO_ANSWER ? '' : (picked.at(-1) ?? '')
            ) as never)}
        />
        {#if controller.errors[picker.field]}<p
            id="{picker.id}-error"
            role="alert"
            class="mt-1 text-sm font-semibold text-error-700-300"
          >
            {errorText(controller.errors[picker.field]?.[0])}
          </p>{/if}
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
      error={errorText(controller.errors.genderOther?.[0])}
    >
      <TextInput
        id="gender-other"
        name="genderOther"
        type="text"
        maxlength={PROFILE_LIMITS.gender}
        bind:value={$draft.genderOther}
        class={input}
        aria-invalid={controller.errors.genderOther ? 'true' : undefined}
        aria-describedby="gender-other-hint{controller.errors.genderOther
          ? ' gender-other-error'
          : ''}"
      />
    </FormField>
  {/if}

  <FormField
    id="city"
    label={m.profile_city()}
    optional
    error={errorText(controller.errors.city?.[0])}
  >
    <TextInput
      id="city"
      name="city"
      type="text"
      maxlength={PROFILE_LIMITS.city}
      autocomplete="address-level2"
      bind:value={$draft.city}
      class={input}
      aria-invalid={controller.errors.city ? 'true' : undefined}
      aria-describedby="city-hint{controller.errors.city ? ' city-error' : ''}"
    />
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
      invalid={Boolean(controller.errors.timezone)}
      onchange={(picked) => ($draft.timezone = picked[0] ?? '')}
    />
    <p id="timezone-hint" class="mt-1 text-sm text-surface-700-300">{m.profile_timezone_hint()}</p>
    {#if controller.errors.timezone}<p
        id="timezone-error"
        role="alert"
        class="mt-1 text-sm font-semibold text-error-700-300"
      >
        {errorText(controller.errors.timezone[0])}
      </p>{/if}
  </div>

  <fieldset class="grid gap-3" aria-describedby="links-hint">
    <legend class="font-semibold">{m.profile_links()}</legend>
    <p id="links-hint" class="text-sm">{m.profile_links_hint()}</p>

    {#if listError()}
      <p role="alert" class="text-sm font-semibold text-error-700-300">{listError()}</p>
    {/if}

    {#if ids.length === 0}
      <p class="text-sm">{m.profile_links_empty()}</p>
    {/if}

    <ul class="grid gap-4">
      {#each ids as id, index (id)}
        {@const urlError = itemError('linkUrl', index)}
        {@const networkError = itemError('linkNetwork', index)}
        <li class="grid gap-2 rounded-lg border border-surface-200-800 p-3">
          <div class="grid gap-2 sm:grid-cols-4">
            <!-- A native <select>: a positioned popup would need inline styles, which the CSP forbids. -->
            <SelectInput
              name="linkNetwork"
              aria-label={m.profile_link_network({ n: index + 1 })}
              bind:value={$draft.linkNetwork[index]}
              class={select}
              aria-invalid={networkError ? 'true' : undefined}
            >
              {#each NETWORKS as network (network)}
                <option value={network}>{NETWORK_LABELS[network]()}</option>
              {/each}
            </SelectInput>
            <TextInput
              id="link-url-{id}"
              name="linkUrl"
              type="text"
              inputmode="url"
              autocapitalize="none"
              spellcheck="false"
              placeholder="https://"
              aria-label={m.profile_link_url({ n: index + 1 })}
              bind:value={$draft.linkUrl[index]}
              class="{input} sm:col-span-3"
              aria-invalid={urlError ? 'true' : undefined}
              aria-describedby={urlError ? `link-error-${id}` : undefined}
            />
          </div>
          {#if urlError || networkError}
            <p id="link-error-{id}" role="alert" class="text-sm font-semibold text-error-700-300">
              {urlError ?? networkError}
            </p>
          {/if}
          <div class="flex flex-wrap gap-2">
            <Button
              size="custom"
              type="button"
              class={secondary}
              disabled={index === 0}
              aria-label={m.profile_link_up({ n: index + 1 })}
              onclick={() => moveLink(index, -1)}
            >
              <span aria-hidden="true">↑</span>
            </Button>
            <Button
              size="custom"
              type="button"
              class={secondary}
              disabled={index === ids.length - 1}
              aria-label={m.profile_link_down({ n: index + 1 })}
              onclick={() => moveLink(index, 1)}
            >
              <span aria-hidden="true">↓</span>
            </Button>
            <Button
              size="custom"
              type="button"
              class={secondary}
              aria-label={m.profile_link_remove({ n: index + 1 })}
              onclick={() => removeLink(index)}
            >
              <span aria-hidden="true">×</span>
            </Button>
          </div>
        </li>
      {/each}
    </ul>

    <div>
      <Button
        size="custom"
        type="button"
        class={secondary}
        disabled={!canAdd}
        bind:element={addButton}
        onclick={addLink}
      >
        {m.profile_link_add()}
      </Button>
    </div>
    <p class="sr-only" role="status">{announcement}</p>
  </fieldset>

  <div class="flex flex-wrap items-center gap-5">
    <SubmitButton
      submitting={controller.pending}
      delayed={controller.delayed}
      timeout={controller.timeout}
      class="btn h-12 w-full rounded-lg preset-filled-primary-500 px-6 font-semibold sm:w-auto"
    >
      {submitLabel ?? m.profile_submit()}
    </SubmitButton>
    {#if cancelHref}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
      <a href={cancelHref} class="link-underline font-semibold text-link">{m.form_cancel()}</a>
    {/if}
  </div>
</Form>
