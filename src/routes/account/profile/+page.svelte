<script lang="ts">
  import TextInput from '$lib/components/TextInput.svelte';
  import { queryClient } from '$lib/query/context';
  const client = queryClient();
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { atHandle } from '$lib/profile/handle';
  import Avatar from '$lib/components/Avatar.svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import ProfileForm from '$lib/components/ProfileForm.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { toast } from '$lib/toaster';
  import ActionForm from '$lib/components/ActionForm.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { photoSchema } from '$lib/profile/photo';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { directMessagesSchema } from '$lib/messages/schema';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { deleteAccountSchema } from '$lib/profile/delete';
  import { tick } from 'svelte';
  import Form from '$lib/components/Form.svelte';

  let { data, form: result = null } = $props();

  const locale = getLocale();

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
  const heading = 'text-2xl leading-tight font-semibold tracking-tight';

  const photoNotice = $derived(page.url.searchParams.get('foto'));

  // svelte-ignore state_referenced_locally
  const photo = actionForm({
    initial: data.photoForm.data,
    schema: photoSchema,
    domain: 'account',
    initialErrors: result?.form && 'photo' in result.form.data ? result.form.errors : {},
    onSuccess: () => {},
    errorMessage: m.account_photo_error_failed,
  });
  const photoError = $derived(photo.errors.photo?.[0]);

  // The photo goes up as soon as it is picked (and cropped, see ImageUpload).
  let photoForm = $state<HTMLFormElement>();
  async function picked(files: File[]) {
    photo.change('photo', files[0]);
    if (!files[0]) return;
    await tick();
    photoForm?.requestSubmit();
  }

  // svelte-ignore state_referenced_locally
  const closing = actionForm({
    initial:
      result?.form && 'confirm' in result.form.data ? result.form.data : data.deleteForm.data,
    schema: deleteAccountSchema,
    initialErrors: result?.form && 'confirm' in result.form.data ? result.form.errors : {},
    onSuccess: () => client.clear(),
    errorMessage: m.auth_error_failed,
  });
  const { draft: closingData } = closing;
  let messagingForm = $state<HTMLFormElement>();
  const restoreMessaging = () => {
    messaging.change('enabled', !messaging.values.enabled);
    toast.error(m.messages_setting_failed());
  };
  // svelte-ignore state_referenced_locally
  const messaging = actionForm({
    initial: data.messagesForm.data,
    schema: directMessagesSchema,
    refresh: false,
    domain: 'account',
    onSuccess: () => toast.success(m.messages_setting_saved()),
    onFailure: restoreMessaging,
    onError: restoreMessaging,
    errorMessage: m.messages_setting_failed,
  });

  const photoErrors: Record<string, () => string> = {
    empty: m.account_photo_error_empty,
    too_big: m.account_photo_error_too_big,
    not_an_image: m.account_photo_error_type,
    upload_failed: m.account_photo_error_failed,
  };

  const check = 'M5 12.5l4.5 4.5L19 7.5';
  const cross = 'M6 6l12 12M18 6L6 18';
</script>

<svelte:head>
  <title>{m.account_profile_title()} · Mesa Aberta</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#snippet mark(path: string)}
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="mt-1 shrink-0"><path d={path} /></svg
  >
{/snippet}

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[
      ...(data.username ? [{ label: atHandle(data.username), href: `/u/${data.username}` }] : []),
      { label: m.nav_edit_profile() },
    ]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.account_profile_title()}
  </h1>
  <p class="mt-2 max-w-md text-base text-muted md:mt-3 md:max-w-xl md:text-xl">
    {m.account_profile_lede()}
  </p>

  <div class="mt-8 grid gap-6 lg:grid-cols-3 lg:items-start">
    <div class="grid gap-6 lg:col-span-2">
      <section aria-labelledby="photo-heading" class={card}>
        <h2 id="photo-heading" class={heading}>{m.account_photo()}</h2>
        <div class="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <!-- Without a picture, the upload shows the initial the app draws in its place. -->
          {#if !data.avatarUrl}
            <Avatar src={null} name={data.form.data.name || data.username} size={80} />
          {/if}
          <div class="grid gap-3">
            <Form
              bind:element={photoForm}
              action="?/photo"
              enctype="multipart/form-data"
              onsubmit={photo.submit}
            >
              <ImageUpload
                id="photo"
                name="photo"
                kind="avatar"
                label={m.account_photo()}
                hint={m.account_photo_hint()}
                error={photoError
                  ? (photoErrors[photoError]?.() ?? m.account_photo_error_failed())
                  : undefined}
                currentUrl={data.avatarUrl}
                onpick={picked}
              />
            </Form>
            {#if data.hasUploadedPhoto}
              <ActionForm
                action="?/removePhoto"
                label={m.account_photo_remove()}
                buttonClass="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
              />
            {/if}
            {#if photoNotice}
              <p role="status" class="text-sm font-semibold">
                {photoNotice === 'salva' ? m.account_photo_saved() : m.account_photo_removed()}
              </p>
            {/if}
          </div>
        </div>
      </section>

      <section aria-labelledby="details" class={card}>
        <h2 id="details" class={heading}>{m.account_details()}</h2>
        <div class="mt-6 grid max-w-xl gap-1">
          <label for="email" class="label-text block font-semibold">{m.account_email()}</label>
          <p id="email-hint" class="text-sm text-surface-700-300">{m.account_email_hint()}</p>
          <TextInput
            id="email"
            type="email"
            value={data.email}
            readonly
            aria-describedby="email-hint"
            class="mt-1 input h-12 w-full rounded-lg border-surface-200-800 bg-surface-950-50/5 px-3 text-muted"
          />
        </div>
        <div class="mt-6">
          <ProfileForm
            form={result?.form && 'username' in result.form.data
              ? { ...result.form, data: result.form.data }
              : data.form}
            action="?/save"
            usernameLocked
            submitLabel={m.account_profile_save()}
            cancelHref={data.username ? localizedHref(`/u/${data.username}`, locale) : undefined}
            onsaved={() => {
              toast.success(m.account_profile_saved());
              // Saved: back to the page everyone else sees.
              // After a tick, so the leave guard sees the draft as saved.
              if (data.username) {
                void tick().then(() => goto(localizedHref(`/u/${data.username}`, locale)));
              }
            }}
          />
        </div>
      </section>

      <section aria-labelledby="direct-messages" class={card}>
        <h2 id="direct-messages" class={heading}>{m.messages_setting_title()}</h2>
        <Form
          bind:element={messagingForm}
          action="?/messages"
          onsubmit={messaging.submit}
          class="mt-4"
        >
          <Switch
            checked={messaging.values.enabled}
            disabled={messaging.pending}
            onCheckedChange={(event) => {
              messaging.change('enabled', event.checked);
              void tick().then(() => messagingForm?.requestSubmit());
            }}
            class="flex items-center justify-between gap-4"
          >
            <Switch.Label class="font-semibold">{m.messages_setting_label()}</Switch.Label>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.HiddenInput />
            <input type="hidden" name="enabled" value={String(messaging.values.enabled)} />
          </Switch>
        </Form>
        <p class="mt-3 max-w-prose text-muted">{m.messages_setting_help()}</p>
      </section>

      <section aria-labelledby="your-data" class={card}>
        <h2 id="your-data" class={heading}>{m.account_data_title()}</h2>
        <p class="mt-3 max-w-prose">
          {m.account_data_text()}
          <a href={localizedHref('/privacy', locale)} class="link-underline text-surface-950-50"
            >{m.privacy_title()}</a
          >.
        </p>
        <a
          href={localizedHref('/account/export', locale)}
          download
          data-sveltekit-reload
          class="mt-5 btn h-12 gap-2 rounded-lg border-2 border-primary-500 px-6 font-semibold"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="shrink-0"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg
          >
          {m.account_export()}
        </a>

        <div class="mt-8 border-t border-surface-200-800 pt-6">
          <h3 class="text-lg font-semibold">{m.account_delete_title()}</h3>
          <p class="mt-2 max-w-prose text-muted">{m.account_delete_text()}</p>
          <Form action="?/delete" onsubmit={closing.submit} class="mt-4 grid max-w-sm gap-3">
            <label for="confirm" class="label-text font-semibold"
              >{m.account_delete_confirm()}</label
            >
            <TextInput
              id="confirm"
              name="confirm"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              placeholder={data.username}
              bind:value={$closingData.confirm}
              aria-invalid={closing.errors.confirm ? 'true' : undefined}
              aria-describedby={closing.errors.confirm ? 'confirm-error' : undefined}
              class="input h-12 w-full rounded-lg border-surface-200-800 bg-panel px-3"
            />
            {#if closing.errors.confirm}
              <p id="confirm-error" role="alert" class="text-sm font-semibold text-error-700-300">
                {m.account_delete_error()}
              </p>
            {/if}
            <div>
              <SubmitButton
                submitting={closing.pending}
                delayed={closing.delayed}
                timeout={closing.timeout}
                class="btn h-12 rounded-lg border-2 border-surface-200-800 px-6 font-semibold text-error-alert hover:preset-tonal"
              >
                {m.account_delete_button()}
              </SubmitButton>
            </div>
          </Form>
        </div>
      </section>
    </div>

    <aside aria-labelledby="seen" class={card}>
      <h2 id="seen" class="text-xl font-semibold">{m.account_seen_title()}</h2>
      <ul class="mt-4 grid gap-3 text-sm">
        <li class="flex gap-3">{@render mark(check)}{m.account_seen_username()}</li>
        <li class="flex gap-3">{@render mark(check)}{m.account_seen_rating()}</li>
        <li class="flex gap-3 text-muted">{@render mark(cross)}{m.account_seen_email()}</li>
        <li class="flex gap-3 text-muted">{@render mark(cross)}{m.account_seen_comments()}</li>
      </ul>
    </aside>
  </div>
</section>
