<script lang="ts">
  import AdminPageHead from '$lib/components/AdminPageHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import UserText from '$lib/components/UserText.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { queryClient } from '$lib/query/context';
  import { apiRead } from '$lib/api/http';
  import { onMount } from 'svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from '$lib/components/Form.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import NotificationIcon from '$lib/components/NotificationIcon.svelte';
  import RichText from '$lib/components/RichText.svelte';
  import RichTextField from '$lib/components/RichTextField.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { ANNOUNCEMENT_LIMITS, announcementSchema } from '$lib/notifications/announcement';
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

  let { data, form: result = null } = $props();

  const locale = getLocale();
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);

  // The first post only asks the server how many it reaches; the confirm step posts again with
  // `confirmed`. A change to any field after that takes the confirm step away, so what is sent is
  // always what was counted.
  // svelte-ignore state_referenced_locally
  let confirming = $state(
    ((result?.form ?? data.form).message as AnnouncementMessage | undefined)?.code === 'confirm',
  );
  let mounted = $state(false);
  onMount(() => (mounted = true));

  // svelte-ignore state_referenced_locally
  const initial = result?.form ?? data.form;
  const controller = actionForm({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
    schema: announcementSchema,
    errorMessage: m.admin_announce_error_invalid,
    onSuccess() {
      confirming = false;
      controller.reset();
      toast.success(m.admin_announce_sent());
    },
    onResult(result) {
      if (result.type === 'success') {
        confirming = controller.message?.code === 'confirm';
        return true;
      }
    },
  });
  const { draft } = controller;

  const shown = $derived(controller.message as AnnouncementMessage | undefined);
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
  const previewIcon = $derived(($draft.icon || TONE_ICON[$draft.tone]) as AnnouncementIcon);
  const previewText = $derived(
    $draft.title.trim()
      ? notificationText({
          type: 'system_announcement',
          icon: previewIcon,
          title: $draft.title.trim(),
          body: $draft.body.trim() || null,
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
  const client = queryClient();
  let recipientQuery = $state('');
  const recipientLookup = createQuery(
    () => ({
      queryKey: ['admin-recipient', 'admin', recipientQuery],
      enabled: recipientQuery.length >= 2 && $draft.audience === 'specific_user',
      queryFn: ({ signal }) =>
        apiRead<string[]>(
          `${localizedHref('/admin/notifications/users', locale)}?q=${encodeURIComponent(recipientQuery)}`,
          signal,
        ),
      staleTime: 30_000,
      retry: false,
    }),
    () => client,
  );
  const suggestions = $derived(recipientQuery.length >= 2 ? (recipientLookup.data ?? []) : []);
  let recipientInput = $state('');
  function suggest(value: string) {
    recipientInput = value.trim().replace(/^@/, '');
  }
  $effect(() => {
    const value = recipientInput;
    const timer = setTimeout(() => (recipientQuery = value), 200);
    return () => clearTimeout(timer);
  });

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
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_announce_title() }]}
    class="mb-6"
  />
  <AdminPageHead title={m.admin_announce_title()} lede={m.admin_announce_lede()} />

  <div class="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
    <Form
      onsubmit={controller.submit}
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
        error={fieldError(controller.errors.title)}
      >
        <TextInput
          id="title"
          name="title"
          required
          maxlength={ANNOUNCEMENT_LIMITS.title}
          bind:value={$draft.title}
          aria-invalid={controller.errors.title ? 'true' : undefined}
          aria-describedby="title-hint{controller.errors.title ? ' title-error' : ''}"
          class="{input} w-full"
        />
      </FormField>

      <FormField
        id="body"
        label={m.admin_announce_field_body()}
        hint={m.admin_announce_body_hint({ max: ANNOUNCEMENT_LIMITS.body })}
        error={fieldError(controller.errors.body)}
      >
        <RichTextField
          id="body"
          name="body"
          rows={4}
          maxlength={ANNOUNCEMENT_LIMITS.body}
          bind:value={$draft.body}
          invalid={Boolean(controller.errors.body)}
          describedby="body-hint{controller.errors.body ? ' body-error' : ''}"
        />
      </FormField>

      <fieldset class="grid gap-3 sm:grid-cols-3">
        <legend class="mb-2 font-semibold sm:col-span-3">{m.admin_announce_field_tone()}</legend>
        {#each ANNOUNCEMENT_TONES as tone (tone)}
          <label class={choice}>
            <input type="radio" name="tone" value={tone} bind:group={$draft.tone} />
            {TONE_LABELS[tone]}
          </label>
        {/each}
      </fieldset>

      <fieldset class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend class="mb-2 font-semibold sm:col-span-4">{m.admin_announce_field_icon()}</legend>
        <label class={choice}>
          <input type="radio" name="icon" value="" bind:group={$draft.icon} />
          <NotificationIcon icon={TONE_ICON[$draft.tone]} class="text-muted" />
          {m.admin_announce_icon_auto()}
        </label>
        {#each ANNOUNCEMENT_ICONS as icon (icon)}
          <label class={choice}>
            <input type="radio" name="icon" value={icon} bind:group={$draft.icon} />
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
              <input type="radio" name="audience" value={audience} bind:group={$draft.audience} />
              {AUDIENCE_LABELS[audience]}
            </span>
            {#if size(audience)}<span class="text-sm text-muted">{size(audience)}</span>{/if}
          </label>
        {/each}
      </fieldset>

      {#if $draft.audience === 'specific_user' || !mounted}
        <FormField
          id="recipient"
          label={m.admin_announce_field_recipient()}
          hint={m.admin_announce_recipient_hint()}
          error={fieldError(controller.errors.recipient)}
        >
          <TextInput
            id="recipient"
            name="recipient"
            list="recipient-suggestions"
            autocomplete="off"
            maxlength={ANNOUNCEMENT_LIMITS.recipient}
            bind:value={$draft.recipient}
            oninput={(event) => suggest(event.currentTarget.value)}
            aria-invalid={controller.errors.recipient ? 'true' : undefined}
            aria-describedby="recipient-hint{controller.errors.recipient ? ' recipient-error' : ''}"
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
        error={fieldError(controller.errors.link)}
      >
        <TextInput
          id="link"
          name="link"
          maxlength={ANNOUNCEMENT_LIMITS.link}
          placeholder="/tables"
          bind:value={$draft.link}
          aria-invalid={controller.errors.link ? 'true' : undefined}
          aria-describedby="link-hint{controller.errors.link ? ' link-error' : ''}"
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
          <p class="mt-1"><UserText text={confirmText} username={shown?.recipient} /></p>
          <div class="mt-4 flex flex-wrap gap-3">
            <Button
              size="custom"
              type="submit"
              name="confirmed"
              value="true"
              class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
              >{m.admin_announce_confirm_send()}</Button
            >
            <Button
              size="custom"
              type="button"
              onclick={() => (confirming = false)}
              class="btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold"
              >{m.admin_announce_confirm_back()}</Button
            >
          </div>
        </div>
      {:else}
        <p>
          <SubmitButton
            submitting={controller.pending}
            delayed={controller.delayed}
            timeout={controller.timeout}
            class="btn h-12 rounded-lg preset-filled-primary-500 px-6 font-semibold"
            >{m.admin_announce_review()}</SubmitButton
          >
        </p>
      {/if}
    </Form>

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
              <RichText html={sent.body} class="mt-1" />
              <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>
                  {#if sent.audience === 'specific_user'}<UserText
                      text={m.admin_history_to_person({
                        username: sent.recipient ? `@${sent.recipient}` : m.admin_history_someone(),
                      })}
                      username={sent.recipient}
                    />{:else}{AUDIENCE_LABELS[sent.audience]}{/if}
                </span>
                <span>
                  {m.admin_history_notified({ count: number(sent.notified) })}
                </span>
                <span>
                  <UserText
                    text={m.admin_history_by({
                      author: sent.author ? `@${sent.author}` : m.admin_history_someone(),
                    })}
                    username={sent.author}
                  />
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
