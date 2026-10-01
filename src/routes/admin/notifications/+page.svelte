<script lang="ts">
  import { onMount } from 'svelte';
  import { superForm } from 'sveltekit-superforms';
  import FormField from '$lib/components/FormField.svelte';
  import NotificationIcon from '$lib/components/NotificationIcon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { ANNOUNCEMENT_LIMITS } from '$lib/notifications/announcement';
  import type { AnnouncementMessage } from '$lib/notifications/announcement-message';
  import {
    ANNOUNCEMENT_AUDIENCES,
    ANNOUNCEMENT_ICONS,
    ANNOUNCEMENT_TONES,
    TONE_ICON,
    type AnnouncementAudience,
    type AnnouncementIcon,
    type AnnouncementTone,
  } from '$lib/notifications/kinds';
  import { notificationText } from '$lib/notifications/text';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { shownTimezone } from '$lib/time/shown-timezone';
  import { toast } from '$lib/toaster';

  let { data } = $props();

  const locale = getLocale();
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);

  // The first post only asks the server how many it reaches; the confirm step posts again with
  // `confirmed`. A change to any field after that takes the confirm step away, so what is sent is
  // always what was counted.
  // svelte-ignore state_referenced_locally
  let confirming = $state(
    (data.form.message as AnnouncementMessage | undefined)?.code === 'confirm',
  );
  let mounted = $state(false);
  onMount(() => (mounted = true));

  // svelte-ignore state_referenced_locally
  const { form, errors, message, enhance, submitting, delayed, timeout, reset } = superForm(
    data.form,
    {
      // The review step answers with a valid form; resetting then would blank what the confirm
      // post must send. Only a sent announcement clears the fields.
      resetForm: false,
      invalidateAll: true,
      onResult({ result }) {
        if (result.type === 'redirect') {
          confirming = false;
          reset();
          toast.success(m.admin_announce_sent());
        }
      },
      onUpdated({ form }) {
        confirming = (form.message as AnnouncementMessage | undefined)?.code === 'confirm';
      },
    },
  );

  const shown = $derived($message as AnnouncementMessage | undefined);
  const confirmStep = $derived(shown?.code === 'confirm' && confirming);

  const ICON_LABELS: Record<AnnouncementIcon, string> = {
    megaphone: m.admin_announce_icon_megaphone(),
    wrench: m.admin_announce_icon_wrench(),
    'alert-triangle': m.admin_announce_icon_alert_triangle(),
    sparkles: m.admin_announce_icon_sparkles(),
    gift: m.admin_announce_icon_gift(),
    info: m.admin_announce_icon_info(),
  };
  const TONE_LABELS: Record<AnnouncementTone, string> = {
    info: m.admin_announce_tone_info(),
    warning: m.admin_announce_tone_warning(),
    announcement: m.admin_announce_tone_announcement(),
  };
  const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
    all_active_users: m.admin_announce_audience_all_active_users(),
    game_masters: m.admin_announce_audience_game_masters(),
    active_players: m.admin_announce_audience_active_players(),
    specific_user: m.admin_announce_audience_specific_user(),
  };
  const size = (audience: AnnouncementAudience) => {
    if (audience === 'specific_user') return null;
    const n = data.sizes[audience];
    return m.admin_announce_audience_size({ count: number(n) });
  };

  const fieldError = (messages: string[] | undefined) => {
    switch (messages?.[0]) {
      case undefined:
        return undefined;
      case 'too_small':
      case 'required':
        return m.form_error_required();
      case 'too_big':
        return m.form_error_too_big();
      case 'not_site_path':
        return m.admin_announce_error_not_site_path();
      case 'not_found':
        return m.admin_announce_error_not_found();
      default:
        return m.form_error_invalid();
    }
  };

  // The bell's own wording and icon, from what is typed so far.
  const previewIcon = $derived(($form.icon || TONE_ICON[$form.tone]) as AnnouncementIcon);
  const previewText = $derived(
    $form.title.trim()
      ? notificationText({
          type: 'system_announcement',
          icon: previewIcon,
          title: $form.title.trim(),
          body: $form.body.trim() || null,
          metadata: {},
          actor: null,
        })
      : null,
  );

  const confirmText = $derived(
    !shown || shown.code !== 'confirm'
      ? ''
      : shown.recipient
        ? m.admin_announce_confirm_person({ username: shown.recipient })
        : m.admin_announce_confirm({ count: number(shown.count ?? 0) }),
  );

  // Suggestions for the recipient field, as the admin types a username.
  let suggestions = $state<string[]>([]);
  let lookup: ReturnType<typeof setTimeout> | undefined;
  function suggest(value: string) {
    clearTimeout(lookup);
    const query = value.trim().replace(/^@/, '');
    if (query.length < 2) {
      suggestions = [];
      return;
    }
    lookup = setTimeout(async () => {
      try {
        const response = await fetch(
          `${localizedHref('/admin/notifications/users', locale)}?q=${encodeURIComponent(query)}`,
        );
        if (response.ok) suggestions = await response.json();
      } catch {
        // No suggestions; the field still takes what is typed.
      }
    }, 200);
  }

  const when = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: shownTimezone('America/Sao_Paulo'),
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

  const STATUS: Record<string, { label: string; tone: string }> = {
    delivered: { label: m.admin_history_status_delivered(), tone: 'preset-tonal-success' },
    pending: { label: m.admin_history_status_pending(), tone: 'preset-tonal-warning' },
    failed: { label: m.admin_history_status_failed(), tone: 'preset-tonal-error' },
  };

  const input = 'input h-12 rounded-lg border-surface-200-800 bg-panel px-3';
  const choice =
    'flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-3 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10';
</script>

<svelte:head>
  <title>{m.admin_announce_title()} · {m.admin_title()}</title>
</svelte:head>

<section class="pt-8 pb-4">
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {m.admin_announce_title()}
  </h1>
  <p class="mt-4 max-w-2xl text-lg">{m.admin_announce_lede()}</p>

  <div class="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
    <form
      method="POST"
      use:enhance
      oninput={() => (confirming = false)}
      class="grid gap-6"
      aria-labelledby="compose"
    >
      <h2 id="compose" class="text-2xl font-semibold tracking-tight">
        {m.admin_announce_compose()}
      </h2>

      {#if shown?.code === 'empty' || shown?.code === 'invalid'}
        <p role="alert" class="rounded-lg bg-error-500/10 p-4 font-semibold text-error-700-300">
          {shown.code === 'empty'
            ? m.admin_announce_error_empty()
            : m.admin_announce_error_invalid()}
        </p>
      {/if}

      <FormField
        id="title"
        label={m.admin_announce_field_title()}
        hint={m.admin_announce_length_hint({ max: ANNOUNCEMENT_LIMITS.title })}
        error={fieldError($errors.title)}
      >
        <input
          id="title"
          name="title"
          required
          maxlength={ANNOUNCEMENT_LIMITS.title}
          bind:value={$form.title}
          aria-invalid={$errors.title ? 'true' : undefined}
          aria-describedby="title-hint{$errors.title ? ' title-error' : ''}"
          class="{input} w-full"
        />
      </FormField>

      <FormField
        id="body"
        label={m.admin_announce_field_body()}
        hint={m.admin_announce_body_hint({ max: ANNOUNCEMENT_LIMITS.body })}
        error={fieldError($errors.body)}
      >
        <textarea
          id="body"
          name="body"
          required
          rows="4"
          maxlength={ANNOUNCEMENT_LIMITS.body}
          bind:value={$form.body}
          aria-invalid={$errors.body ? 'true' : undefined}
          aria-describedby="body-hint{$errors.body ? ' body-error' : ''}"
          class="textarea w-full rounded-lg border-surface-200-800 bg-panel p-3"></textarea>
      </FormField>

      <fieldset class="grid gap-3 sm:grid-cols-3">
        <legend class="mb-2 font-semibold sm:col-span-3">{m.admin_announce_field_tone()}</legend>
        {#each ANNOUNCEMENT_TONES as tone (tone)}
          <label class={choice}>
            <input type="radio" name="tone" value={tone} bind:group={$form.tone} />
            {TONE_LABELS[tone]}
          </label>
        {/each}
      </fieldset>

      <fieldset class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend class="mb-2 font-semibold sm:col-span-4">{m.admin_announce_field_icon()}</legend>
        <label class={choice}>
          <input type="radio" name="icon" value="" bind:group={$form.icon} />
          <NotificationIcon icon={TONE_ICON[$form.tone]} class="text-muted" />
          {m.admin_announce_icon_auto()}
        </label>
        {#each ANNOUNCEMENT_ICONS as icon (icon)}
          <label class={choice}>
            <input type="radio" name="icon" value={icon} bind:group={$form.icon} />
            <NotificationIcon {icon} />
            {ICON_LABELS[icon]}
          </label>
        {/each}
      </fieldset>

      <fieldset class="grid gap-3">
        <legend class="mb-2 font-semibold">{m.admin_announce_field_audience()}</legend>
        {#each ANNOUNCEMENT_AUDIENCES as audience (audience)}
          <label class="{choice} justify-between">
            <span class="flex items-center gap-3">
              <input type="radio" name="audience" value={audience} bind:group={$form.audience} />
              {AUDIENCE_LABELS[audience]}
            </span>
            {#if size(audience)}<span class="text-sm text-muted">{size(audience)}</span>{/if}
          </label>
        {/each}
      </fieldset>

      {#if $form.audience === 'specific_user' || !mounted}
        <FormField
          id="recipient"
          label={m.admin_announce_field_recipient()}
          hint={m.admin_announce_recipient_hint()}
          error={fieldError($errors.recipient)}
        >
          <input
            id="recipient"
            name="recipient"
            list="recipient-suggestions"
            autocomplete="off"
            maxlength={ANNOUNCEMENT_LIMITS.recipient}
            bind:value={$form.recipient}
            oninput={(event) => suggest(event.currentTarget.value)}
            aria-invalid={$errors.recipient ? 'true' : undefined}
            aria-describedby="recipient-hint{$errors.recipient ? ' recipient-error' : ''}"
            class="{input} w-full"
          />
          <datalist id="recipient-suggestions">
            {#each suggestions as username (username)}<option value="@{username}"></option>{/each}
          </datalist>
        </FormField>
      {/if}

      <FormField
        id="link"
        label={m.admin_announce_field_link()}
        hint={m.admin_announce_link_hint()}
        error={fieldError($errors.link)}
      >
        <input
          id="link"
          name="link"
          maxlength={ANNOUNCEMENT_LIMITS.link}
          placeholder="/tables"
          bind:value={$form.link}
          aria-invalid={$errors.link ? 'true' : undefined}
          aria-describedby="link-hint{$errors.link ? ' link-error' : ''}"
          class="{input} w-full"
        />
      </FormField>

      {#if confirmStep}
        <div
          role="alert"
          aria-labelledby="confirm-title"
          class="rounded-lg border border-lamp bg-lamp-wash p-5"
        >
          <h3 id="confirm-title" class="text-lg font-semibold">
            {m.admin_announce_confirm_title()}
          </h3>
          <p class="mt-1">{confirmText}</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              name="confirmed"
              value="true"
              class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
              >{m.admin_announce_confirm_send()}</button
            >
            <button
              type="button"
              onclick={() => (confirming = false)}
              class="btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold"
              >{m.admin_announce_confirm_back()}</button
            >
          </div>
        </div>
      {:else}
        <p>
          <SubmitButton
            submitting={$submitting}
            delayed={$delayed}
            timeout={$timeout}
            class="btn h-12 rounded-lg preset-filled-primary-500 px-6 font-semibold"
            >{m.admin_announce_review()}</SubmitButton
          >
        </p>
      {/if}
    </form>

    <aside aria-labelledby="preview" class="lg:sticky lg:top-6 lg:self-start">
      <h2 id="preview" class="text-2xl font-semibold tracking-tight">
        {m.admin_announce_preview()}
      </h2>
      <div
        class="mt-4 w-80 max-w-full card border border-surface-200-800 bg-surface-100-900 p-2 shadow-xl"
      >
        <div
          data-testid="announcement-preview"
          class="flex items-start gap-3 rounded-lg p-2 text-left"
        >
          <NotificationIcon icon={previewIcon} class="mt-1 text-muted" />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold wrap-break-word">
              {previewText ?? m.admin_announce_preview_empty()}
            </span>
            <span class="block text-xs text-muted">{m.admin_announce_preview_now()}</span>
          </span>
          <span class="mt-2 size-2 shrink-0 rounded-full bg-primary-500"></span>
        </div>
      </div>
    </aside>
  </div>
</section>

<section aria-labelledby="history" class="mt-12 pb-8">
  <h2 id="history" class="text-3xl font-semibold tracking-tight">{m.admin_history_title()}</h2>
  {#if data.history.length === 0}
    <p class="mt-3">{m.admin_history_empty()}</p>
  {:else}
    <ul class="mt-5 grid gap-4">
      {#each data.history as sent (sent.id)}
        <li class="rounded-lg border border-surface-200-800 bg-panel p-5">
          <div class="flex items-start gap-3">
            <NotificationIcon icon={sent.icon} class="mt-1 text-muted" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-lg font-semibold wrap-break-word">{sent.title}</h3>
                <span class="badge rounded-full text-xs font-semibold {STATUS[sent.status].tone}"
                  >{STATUS[sent.status].label}</span
                >
              </div>
              <p class="mt-1 wrap-break-word whitespace-pre-line">{sent.body}</p>
              <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>
                  {sent.audience === 'specific_user'
                    ? m.admin_history_to_person({
                        username: sent.recipient ? `@${sent.recipient}` : m.admin_history_someone(),
                      })
                    : AUDIENCE_LABELS[sent.audience]}
                </span>
                <span>
                  {m.admin_history_notified({ count: number(sent.notified) })}
                </span>
                <span>
                  {m.admin_history_by({
                    author: sent.author ? `@${sent.author}` : m.admin_history_someone(),
                  })}
                </span>
                <time datetime={sent.sentAt.toISOString()}>{when(sent.sentAt)}</time>
                <span>{TONE_LABELS[sent.tone]}</span>
                {#if sent.link}<span>{sent.link}</span>{/if}
              </p>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
