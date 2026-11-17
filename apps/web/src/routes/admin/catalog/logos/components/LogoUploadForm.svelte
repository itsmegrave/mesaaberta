<script lang="ts">
  // A logo the admin sends by hand for a system the search could not fill. It is approved as sent,
  // so it asks where the logo comes from: a logo is a trademark, and the system page links there.
  import { logoUploadSchema } from '@mesaaberta/core/admin/system-logos';
  import FormField from '#lib/components/ui/FormField.svelte';
  import ImageUpload from '#lib/components/ui/ImageUpload.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { errorText, formProblem } from '#lib/tables/form-values.js';
  import { toast } from '#lib/toaster.js';

  let { systemId, name }: { systemId: string; name: string } = $props();

  type Values = { systemId: string; sourcePage: string; attribution: string; logo?: File };
  // svelte-ignore state_referenced_locally
  const controller = actionForm<Values>({
    initial: { systemId, sourcePage: '', attribution: '' },
    schema: logoUploadSchema,
    onSuccess: () => toast.success(m.admin_logos_toast_upload()),
    errorMessage: m.form_error_unavailable,
  });
  const { draft } = controller;

  const say = (field: keyof Values) => {
    const code = controller.errors[field]?.[0];
    if (!code) return undefined;
    if (code === 'invalid_url') return m.admin_logos_upload_source_invalid();
    if (code === 'empty' || code === 'required') return m.form_error_required();
    return errorText(code, field === 'logo' ? 'image' : field);
  };
  const formError = $derived(formProblem(controller.message));
  const id = (field: string) => `${field}-${systemId}`;
  const input = 'input h-11 w-full rounded-lg border-control border-ink-muted bg-panel px-3';
</script>

<MAForm
  action="?/upload"
  enctype="multipart/form-data"
  onsubmit={controller.submit}
  class="flex flex-col gap-3 border-t border-surface-200-800 pt-3"
  aria-label={m.admin_logos_upload_label({ name })}
>
  <input type="hidden" name="systemId" value={systemId} />
  <ImageUpload
    id={id('logo')}
    name="logo"
    kind="avatar"
    label={m.admin_logos_upload()}
    hint={m.admin_logos_upload_hint()}
    error={say('logo')}
    onpick={(files) => {
      controller.change('logo', files[0]);
      controller.validateField('logo');
    }}
  />
  <FormField id={id('sourcePage')} label={m.admin_logos_upload_source()} error={say('sourcePage')}>
    {#snippet children(aria)}
      <TextInput
        id={id('sourcePage')}
        name="sourcePage"
        type="text"
        inputmode="url"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        placeholder="https://"
        bind:value={$draft.sourcePage}
        class={input}
        {...aria}
      />
    {/snippet}
  </FormField>
  <FormField
    id={id('attribution')}
    label={m.admin_logos_upload_attribution()}
    optional
    error={say('attribution')}
  >
    {#snippet children(aria)}
      <TextInput
        id={id('attribution')}
        name="attribution"
        type="text"
        autocomplete="off"
        bind:value={$draft.attribution}
        class={input}
        {...aria}
      />
    {/snippet}
  </FormField>
  {#if formError}<p role="alert" class="text-sm font-semibold text-error-700-300">
      {formError}
    </p>{/if}
  <MAButton type="submit" variant="primary" size="sm" {controller}
    >{m.admin_logos_upload_submit()}</MAButton
  >
</MAForm>
