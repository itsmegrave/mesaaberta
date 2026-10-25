<script lang="ts">
  // "Perfil público": what everyone sees. The photo and the cover change through their own dialogs
  // and save at once; the name, the bio and the links save with the form below.
  import { page } from '$app/state';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import ProfileForm from '../components/ProfileForm.svelte';
  import SettingsSection from './components/SettingsSection.svelte';
  import UploadDialog from './components/UploadDialog.svelte';
  import { bannerSchema, photoSchema } from '#lib/profile/photo.js';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';
  import type { ProfileInput } from '@mesaaberta/core/profile/schema';

  let { data, form: result = null } = $props();

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
  const removeButton = 'btn h-12 rounded-lg px-4 font-semibold text-error-alert hover:preset-tonal';

  const photoErrors: Record<string, () => string> = {
    empty: m.account_photo_error_empty,
    too_big: m.account_photo_error_too_big,
    not_an_image: m.account_photo_error_type,
    upload_failed: m.account_photo_error_failed,
  };
  const bannerErrors: Record<string, () => string> = {
    empty: m.account_banner_error_empty,
    too_big: m.account_banner_error_too_big,
    not_an_image: m.account_banner_error_type,
    upload_failed: m.account_banner_error_failed,
  };
  // The answer of a form sent without JavaScript, for the field it was about.
  const returned = (field: string) =>
    result?.form && field in result.form.data
      ? (result.form.errors[field]?.[0] as string | undefined)
      : undefined;

  const notices: Record<string, Record<string, () => string>> = {
    foto: { salva: m.account_photo_saved, removida: m.account_photo_removed },
    capa: { salva: m.account_banner_saved, removida: m.account_banner_removed },
  };
  const notice = $derived(
    Object.entries(notices)
      .map(([key, texts]) => texts[page.url.searchParams.get(key) ?? '']?.())
      .find(Boolean),
  );
</script>

<SettingsSection title={m.profile_section_public()} lede={m.profile_section_public_lede()}>
  {#snippet aside()}
    {#if data.username}
      <a href="/u/{data.username}" class="link-underline font-semibold text-link"
        >{m.profile_view_public()}</a
      >
    {/if}
  {/snippet}
</SettingsSection>

<section aria-labelledby="images-heading" class={card}>
  <h3 id="images-heading" class="sr-only">{m.account_images()}</h3>
  <!-- The cover as the profile shows it (4:1), with the photo over its bottom-left corner. -->
  <div class="relative pb-12">
    {#if data.bannerUrl}
      <img
        src={data.bannerUrl}
        alt=""
        class="aspect-4/1 w-full rounded-lg border border-surface-200-800 object-cover"
      />
    {:else}
      <div
        class="flex aspect-4/1 w-full items-center justify-center rounded-lg border-2 border-dashed border-surface-200-800 bg-surface-wash text-sm text-muted"
      >
        {m.account_banner_none()}
      </div>
    {/if}
    <div class="absolute bottom-0 left-4 rounded-full bg-panel p-1 md:left-6">
      <Avatar src={data.avatarUrl} name={data.form.data.name || data.username} size={96} />
    </div>
  </div>

  <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <UploadDialog
      id="photo"
      name="photo"
      action="?/photo"
      kind="avatar"
      schema={photoSchema}
      label={m.account_photo_change()}
      title={m.upload_photo_title()}
      icon="camera"
      errors={photoErrors}
      fallbackError={m.account_photo_error_failed}
      initialError={returned('photo')}
    />
    <UploadDialog
      id="banner"
      name="banner"
      action="?/banner"
      kind="cover"
      schema={bannerSchema}
      label={m.account_banner_change()}
      title={m.upload_banner_title()}
      icon="image"
      errors={bannerErrors}
      fallbackError={m.account_banner_error_failed}
      initialError={returned('banner')}
    />
  </div>
  {#if data.hasUploadedPhoto || data.bannerUrl}
    <div class="mt-3 flex flex-wrap gap-3">
      {#if data.hasUploadedPhoto}
        <ActionForm
          action="?/removePhoto"
          label={m.account_photo_remove()}
          buttonClass={removeButton}
        />
      {/if}
      {#if data.bannerUrl}
        <ActionForm
          action="?/removeBanner"
          label={m.account_banner_remove()}
          buttonClass={removeButton}
        />
      {/if}
    </div>
  {/if}
  {#if notice}
    <p role="status" class="mt-3 text-sm font-semibold">{notice}</p>
  {/if}
</section>

<section aria-label={m.profile_section_public()} class={card}>
  <ProfileForm
    form={result?.form && 'username' in result.form.data
      ? { ...result.form, data: result.form.data as ProfileInput }
      : data.form}
    action="?/save"
    section="public"
    submitLabel={m.account_profile_save()}
    onsaved={() => toast.success(m.account_profile_saved())}
  />
</section>
