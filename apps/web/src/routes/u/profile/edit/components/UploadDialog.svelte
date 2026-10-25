<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  // How a profile picture or cover is changed: a button opens a dialog with the drop zone, and the
  // picked image is framed in the same dialog. "Usar este recorte" sends it at once; the action
  // answers with a redirect, so the page (and the header) shows the new image. Until JavaScript runs
  // it is a plain file field with its own button, so the form works without it.
  import { Dialog, FileUpload, Portal } from '@skeletonlabs/skeleton-svelte';
  import { onMount, tick } from 'svelte';
  import type { ZodType } from 'zod';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ImageCropper from '#lib/components/ui/ImageCropper.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { isDecodable } from '#lib/forms/decodable.js';
  import type { IconName } from '#lib/icons/names.js';
  import { IMAGE_TYPES } from '@mesaaberta/core/forms/files';
  import { m } from '#lib/paraglide/messages.js';

  let {
    id,
    name,
    action,
    kind,
    schema,
    label,
    title,
    icon,
    errors: messages,
    fallbackError,
    initialError,
  }: {
    id: string;
    /** The file field: `photo` or `banner`. */
    name: string;
    action: string;
    /** A person's photo (square, drawn round, 512 px) or the cover (4:1, 1600 px). */
    kind: 'avatar' | 'cover';
    schema: ZodType;
    /** The button's words. */
    label: string;
    title: string;
    icon: IconName;
    /** Each error code the schema or the action answers, in words. */
    errors: Record<string, () => string>;
    fallbackError: () => string;
    /** The code a form sent without JavaScript came back with. */
    initialError?: string;
  } = $props();

  let mounted = $state(false);
  onMount(() => (mounted = true));
  let open = $state(false);
  let element = $state<HTMLFormElement>();

  // svelte-ignore state_referenced_locally
  const upload = actionForm({
    initial: { [name]: undefined as File | undefined },
    schema,
    domain: 'account',
    onSuccess: () => (open = false),
    errorMessage: fallbackError,
  });
  const code = $derived(upload.errors[name]?.[0] ?? upload.errors._errors?.[0] ?? initialError);
  const error = $derived(code ? (messages[code] ?? fallbackError)() : undefined);

  // The picked picture waits in the cropper; what comes out (or nothing, when it is cancelled) is
  // what the field then holds. A file the crop can't take goes on as it is, for the schema to refuse.
  let framing = $state<{ file: File; done: (files: File[]) => void } | null>(null);
  const frame = async (files: File[]) => {
    const [file] = files;
    if (!file || !(IMAGE_TYPES as readonly string[]).includes(file.type)) return files;
    if (!(await isDecodable(file))) return files;
    return new Promise<File[]>((done) => (framing = { file, done }));
  };
  const finish = (files: File[]) => {
    framing?.done(files);
    framing = null;
  };

  async function picked(files: File[]) {
    upload.change(name, files[0]);
    if (!files[0]) return;
    await tick();
    element?.requestSubmit();
  }

  const accept = IMAGE_TYPES.join(',');
  const avatar = $derived(kind === 'avatar');
  const trigger = 'btn h-12 w-full gap-2 rounded-lg btn-secondary px-4 font-semibold sm:w-auto';
</script>

{#if mounted}
  <Dialog
    {open}
    onOpenChange={(details) => {
      open = details.open;
      if (!open) finish([]);
    }}
  >
    <Dialog.Trigger class={trigger}><Icon name={icon} size={20} />{label}</Dialog.Trigger>
    <!-- Built when it opens: a closed dialog would put an inline `style` on the page. -->
    {#if open}<Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
        <Dialog.Positioner
          class="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
        >
          <Dialog.Content
            class="max-h-full w-full max-w-lg overflow-y-auto card rounded-b-none border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl md:rounded-b-lg"
          >
            <div class="flex items-start gap-4">
              <div class="min-w-0 flex-1">
                <Dialog.Title class="text-xl font-semibold">{title}</Dialog.Title>
                <Dialog.Description class="mt-1 text-surface-700-300"
                  >{m.upload_lede()}</Dialog.Description
                >
              </div>
              <Dialog.CloseTrigger
                class="btn size-11 shrink-0 rounded-full p-0 hover:preset-tonal"
                aria-label={m.upload_close()}><Icon name="xmark" size={20} /></Dialog.CloseTrigger
              >
            </div>
            <MAForm
              bind:element
              {action}
              enctype="multipart/form-data"
              onsubmit={upload.submit}
              class="mt-5"
            >
              <FileUpload
                {name}
                maxFiles={1}
                transformFiles={frame}
                ids={{ hiddenInput: id }}
                onFileChange={(details) => void picked(details.acceptedFiles)}
              >
                <FileUpload.Label class="sr-only">{label}</FileUpload.Label>
                <FileUpload.Dropzone
                  class="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-primary-500 bg-surface-950-50/5 px-6 py-10 text-center data-dragging:bg-primary-500/10 {framing
                    ? 'hidden'
                    : ''}"
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby="{id}-formats{error ? ` ${id}-error` : ''}"
                >
                  <Icon name="cloud-upload" size={32} class="text-primary-500" />
                  <p class="font-semibold">{m.upload_drop()}</p>
                </FileUpload.Dropzone>
                <!-- `accept` here only narrows the picker; the schema decides what is refused. -->
                <FileUpload.HiddenInput {accept} />
              </FileUpload>
              {#if framing}
                <ImageCropper
                  bare
                  file={framing.file}
                  aspectRatio={avatar ? 1 : 4}
                  width={avatar ? 512 : 1600}
                  round={avatar}
                  onconfirm={(cropped) => finish([cropped])}
                  onreplace={() => finish([])}
                  oncancel={() => (open = false)}
                  onunreadable={() => finish([framing!.file])}
                />
              {:else}
                <p id="{id}-formats" class="mt-3 text-sm text-muted">{m.upload_formats()}</p>
              {/if}
              {#if upload.pending}
                <p role="status" class="mt-3 text-sm font-semibold">{m.upload_sending()}</p>
              {/if}
              {#if error}
                <p id="{id}-error" role="alert" class="mt-3 text-sm font-semibold text-error-alert">
                  {error}
                </p>
              {/if}
            </MAForm>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>{/if}
  </Dialog>
{:else}
  <MAForm {action} enctype="multipart/form-data" class="grid gap-2">
    <label for={id} class="label-text font-semibold">{label}</label>
    <input
      {id}
      {name}
      type="file"
      {accept}
      aria-describedby="{id}-formats{error ? ` ${id}-error` : ''}"
      aria-invalid={error ? 'true' : undefined}
      class="block w-full text-sm file:mr-3 file:h-12 file:rounded-lg file:border-2 file:border-surface-950-50 file:bg-transparent file:px-4 file:font-semibold"
    />
    <p id="{id}-formats" class="text-sm text-muted">{m.upload_formats()}</p>
    {#if error}
      <p id="{id}-error" role="alert" class="text-sm font-semibold text-error-alert">{error}</p>
    {/if}
    <div>
      <MAButton
        type="submit"
        variant="secondary"
        size="md"
        class="w-full gap-2 bg-panel font-semibold sm:w-auto">{m.upload_send()}</MAButton
      >
    </div>
  </MAForm>
{/if}
