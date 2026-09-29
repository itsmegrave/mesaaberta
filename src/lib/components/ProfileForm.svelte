<script lang="ts">
  import { confirmLeave } from '$lib/forms/leave-guard.svelte';
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
  import { superForm, type SuperValidated } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import FormField from './FormField.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import { timezoneOptions } from '$lib/time/timezone';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages';
  import { MAX_SOCIAL_LINKS, NETWORKS, type Network } from '$lib/profile/social-links';
  import { MAX_USERNAME_LENGTH, normalizeUsername, usernameProblem } from '$lib/profile/username';

  /** What the server says about a username: free, taken, or not acceptable at all. */
  export type Availability = 'free' | 'taken' | 'invalid';

  type Props = {
    form: SuperValidated<ProfileInput>;
    action?: string;
    /** On the profile page the username is shown but cannot change: it was chosen at onboarding. */
    usernameLocked?: boolean;
    submitLabel?: string;
    /** Called after a save that stays on the page (the profile page), to confirm it. */
    onsaved?: () => void;
    /** Asks the server if a (well formed) username is free. Replaced in tests. */
    checkUsername?: (username: string, signal: AbortSignal) => Promise<Availability>;
  };

  const askServer = async (username: string, signal: AbortSignal): Promise<Availability> => {
    const response = await fetch(`/onboarding/username?value=${encodeURIComponent(username)}`, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`availability check answered ${response.status}`);

    return ((await response.json()) as { status: Availability }).status;
  };

  let {
    form: initial,
    action,
    usernameLocked = false,
    submitLabel,
    onsaved,
    checkUsername = askServer,
  }: Props = $props();

  // The form is set up once with what the server loaded; superforms keeps it up to date after that.
  // svelte-ignore state_referenced_locally
  const { form, errors, allErrors, enhance, submitting, delayed, timeout } = superForm(initial, {
    validators: zod4Client(profileSchema),
    resetForm: false,
    taintedMessage: confirmLeave,
    onUpdated: ({ form }) => {
      if (form.valid) onsaved?.();
    },
  });

  // Not picked yet: offer the browser's zone, so saving the form keeps it on the profile. It is an
  // offer, not an edit: untainted, so leaving the page does not ask about unsaved changes.
  // Set once JavaScript runs: until then every field is shown, "Outro"'s own words included.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
    if ($form.timezone) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    form.update((values) => ({ ...values, timezone }), { taint: false });
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

  const input = 'input h-12 w-full rounded-lg border-surface-200-800 bg-panel px-3';
  const secondary =
    'btn h-11 min-w-11 rounded-lg border-2 border-surface-200-800 px-3 font-semibold hover:preset-tonal disabled:opacity-50';

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

  // Superforms keeps an array's own errors under `_errors` and each item's under its index.
  const itemError = (field: 'linkNetwork' | 'linkUrl', index: number) =>
    errorText(($errors[field] as Record<number, string[] | undefined> | undefined)?.[index]?.[0]);
  const listError = () =>
    errorText(($errors.linkUrl as { _errors?: string[] } | undefined)?._errors?.[0]);

  // --- the username, checked against the server while it is typed --------------------------------

  const CHECK_DELAY_MS = 400;
  let availability = $state<'idle' | 'checking' | Availability | 'failed'>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;

  function usernameChanged() {
    clearTimeout(timer);
    request?.abort();
    availability = 'idle';

    // A username that is wrong anyway is not worth a round trip: the form says what is wrong.
    if (usernameProblem($form.username) !== null) return;

    availability = 'checking';
    timer = setTimeout(async () => {
      request = new AbortController();
      const { signal } = request;
      try {
        const status = await checkUsername(normalizeUsername($form.username), signal);
        if (!signal.aborted) availability = status;
      } catch {
        if (!signal.aborted) availability = 'failed';
      }
    }, CHECK_DELAY_MS);
  }

  // A username that arrives already filled in (a suggestion made from the sign-in name) is checked too.
  // svelte-ignore state_referenced_locally
  if ($form.username !== '' && !usernameLocked) usernameChanged();

  const usernameError = $derived(
    errorText($errors.username?.[0]) ??
      (availability === 'taken' ? m.profile_error_taken() : undefined),
  );
  const usernameDescription = $derived(
    ['username-hint', usernameError ? 'username-error' : 'username-status'].join(' '),
  );

  // --- the links: a list to add to, remove from and reorder -------------------------------------

  // Each row keeps an id of its own, so a row that moves keeps what was typed in it and its focus.
  let nextId = 0;
  let ids = $state($form.linkNetwork.map(() => nextId++));
  let announcement = $state('');
  let addButton: HTMLButtonElement | undefined = $state();

  const canAdd = $derived(ids.length < MAX_SOCIAL_LINKS);

  function addLink() {
    $form.linkNetwork = [...$form.linkNetwork, 'instagram'];
    $form.linkUrl = [...$form.linkUrl, ''];
    const id = nextId++;
    ids.push(id);

    tick().then(() => document.getElementById(`link-url-${id}`)?.focus());
  }

  function removeLink(index: number) {
    $form.linkNetwork = $form.linkNetwork.filter((_, i) => i !== index);
    $form.linkUrl = $form.linkUrl.filter((_, i) => i !== index);
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

    $form.linkNetwork = swap($form.linkNetwork);
    $form.linkUrl = swap($form.linkUrl);
    ids = swap(ids);
    announcement = m.profile_link_moved({ n: index + 1, position: to + 1 });
  }
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and stop superforms from validating (it skips a form the browser is asked to check). -->
<form method="POST" {action} use:enhance class="grid max-w-xl gap-6">
  {#if $allErrors.length > 0}
    <p role="alert" class="font-semibold text-error-700-300">{m.profile_error_form()}</p>
  {/if}

  <FormField
    id="username"
    label={m.profile_username()}
    hint={usernameLocked ? m.profile_username_locked_hint() : m.profile_username_hint()}
    error={usernameLocked ? undefined : usernameError}
  >
    <input
      id="username"
      name="username"
      type="text"
      aria-required="true"
      maxlength={MAX_USERNAME_LENGTH}
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
      bind:value={$form.username}
      oninput={usernameChanged}
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
    error={errorText($errors.name?.[0])}
  >
    <input
      id="name"
      name="name"
      type="text"
      maxlength={PROFILE_LIMITS.name}
      autocomplete="name"
      bind:value={$form.name}
      class={input}
      aria-invalid={$errors.name ? 'true' : undefined}
      aria-describedby="name-hint{$errors.name ? ' name-error' : ''}"
    />
  </FormField>

  <div class="grid gap-6 sm:grid-cols-2">
    <FormField
      id="age-range"
      label={m.profile_age_range()}
      hint={m.profile_optional()}
      error={errorText($errors.ageRange?.[0])}
    >
      <select
        id="age-range"
        name="ageRange"
        bind:value={$form.ageRange}
        class={input}
        aria-invalid={$errors.ageRange ? 'true' : undefined}
        aria-describedby="age-range-hint{$errors.ageRange ? ' age-range-error' : ''}"
      >
        <option value="">{m.profile_age_range_none()}</option>
        {#each AGE_RANGES as range (range)}
          <option value={range}>{AGE_RANGE_LABELS[range]()}</option>
        {/each}
      </select>
    </FormField>

    <FormField
      id="gender"
      label={m.profile_gender()}
      hint={m.profile_optional()}
      error={errorText($errors.gender?.[0])}
    >
      <!-- A native <select>: a positioned popup would need inline styles, which the CSP forbids. -->
      <select
        id="gender"
        name="gender"
        bind:value={$form.gender}
        class={input}
        aria-invalid={$errors.gender ? 'true' : undefined}
        aria-describedby="gender-hint{$errors.gender ? ' gender-error' : ''}"
      >
        <option value="">{m.profile_gender_none()}</option>
        {#each GENDER_OPTIONS as option (option)}
          <option value={option}>{GENDER_LABELS[option]()}</option>
        {/each}
      </select>
    </FormField>
  </div>

  <!-- Own words for "Outro". Without JavaScript the field is always there (the server keeps it
       only with "Outro"); with it, the field shows once "Outro" is picked. -->
  {#if !mounted || $form.gender === 'other'}
    <FormField
      id="gender-other"
      label={m.profile_gender_other_label()}
      hint={m.profile_gender_other_hint()}
      error={errorText($errors.genderOther?.[0])}
    >
      <input
        id="gender-other"
        name="genderOther"
        type="text"
        maxlength={PROFILE_LIMITS.gender}
        bind:value={$form.genderOther}
        class={input}
        aria-invalid={$errors.genderOther ? 'true' : undefined}
        aria-describedby="gender-other-hint{$errors.genderOther ? ' gender-other-error' : ''}"
      />
    </FormField>
  {/if}

  <FormField
    id="city"
    label={m.profile_city()}
    hint={m.profile_optional()}
    error={errorText($errors.city?.[0])}
  >
    <input
      id="city"
      name="city"
      type="text"
      maxlength={PROFILE_LIMITS.city}
      autocomplete="address-level2"
      bind:value={$form.city}
      class={input}
      aria-invalid={$errors.city ? 'true' : undefined}
      aria-describedby="city-hint{$errors.city ? ' city-error' : ''}"
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
      value={$form.timezone ? [$form.timezone] : []}
      placeholder={m.profile_timezone_placeholder()}
      invalid={Boolean($errors.timezone)}
      onchange={(picked) => ($form.timezone = picked[0] ?? '')}
    />
    <p id="timezone-hint" class="mt-1 text-sm text-surface-700-300">{m.profile_timezone_hint()}</p>
    {#if $errors.timezone}<p
        id="timezone-error"
        role="alert"
        class="mt-1 text-sm font-semibold text-error-700-300"
      >
        {errorText($errors.timezone[0])}
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
            <select
              name="linkNetwork"
              aria-label={m.profile_link_network({ n: index + 1 })}
              bind:value={$form.linkNetwork[index]}
              class={input}
              aria-invalid={networkError ? 'true' : undefined}
            >
              {#each NETWORKS as network (network)}
                <option value={network}>{NETWORK_LABELS[network]()}</option>
              {/each}
            </select>
            <input
              id="link-url-{id}"
              name="linkUrl"
              type="text"
              inputmode="url"
              autocapitalize="none"
              spellcheck="false"
              placeholder="https://"
              aria-label={m.profile_link_url({ n: index + 1 })}
              bind:value={$form.linkUrl[index]}
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
            <button
              type="button"
              class={secondary}
              disabled={index === 0}
              aria-label={m.profile_link_up({ n: index + 1 })}
              onclick={() => moveLink(index, -1)}
            >
              <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              class={secondary}
              disabled={index === ids.length - 1}
              aria-label={m.profile_link_down({ n: index + 1 })}
              onclick={() => moveLink(index, 1)}
            >
              <span aria-hidden="true">↓</span>
            </button>
            <button
              type="button"
              class={secondary}
              aria-label={m.profile_link_remove({ n: index + 1 })}
              onclick={() => removeLink(index)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </li>
      {/each}
    </ul>

    <div>
      <button
        type="button"
        class={secondary}
        disabled={!canAdd}
        bind:this={addButton}
        onclick={addLink}
      >
        {m.profile_link_add()}
      </button>
    </div>
    <p class="sr-only" role="status">{announcement}</p>
  </fieldset>

  <div>
    <SubmitButton
      submitting={$submitting}
      delayed={$delayed}
      timeout={$timeout}
      class="btn h-12 w-full rounded-lg preset-filled-primary-500 px-6 font-semibold sm:w-auto"
    >
      {submitLabel ?? m.profile_submit()}
    </SubmitButton>
  </div>
</form>
