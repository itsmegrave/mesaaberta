<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  // A form's image (a table's, a campaign's, a partner's logo): a button opens the same modal as the
  // profile's photo and cover, with the drop zone and then the cropper; the framed file goes back
  // into this form's field, sent with the rest when it is saved. The field itself stays in the form
  // (the modal is drawn outside it). Until JavaScript runs it is a plain file field. The type and the
  // size are checked by the form's schema, not here, so every problem reads the same way.
  import { FileUpload } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import ImageCropper from '#lib/components/ui/ImageCropper.svelte';
  import ImageDialog from '#lib/components/ui/ImageDialog.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import { isDecodable } from '#lib/forms/decodable.js';
  import { IMAGE_TYPES } from '@mesaaberta/core/forms/files';
  import { m } from '#lib/paraglide/messages.js';

  let {
    id,
    name,
    label,
    hint,
    error,
    kind = 'image',
    dropText,
    currentUrl = null,
    removed = $bindable(false),
    onpick,
  }: {
    id: string;
    name: string;
    label: string;
    hint: string;
    error?: string;
    /**
     * What it is for: a table's image (5:2, kept or taken off with the form), or a person's photo
     * (square, cropped in a circle; whoever uses it removes the photo on their own).
     */
    kind?: 'image' | 'avatar';
    /** What the drop zone says; "Arraste e solte ou clique para enviar uma imagem" by default. */
    dropText?: string;
    /** The image the table has now, shown above the zone. */
    currentUrl?: string | null;
    /** The current image is to be taken off on save (sent as `removeImage`). */
    removed?: boolean;
    /** The file picked (or none, once removed), for the form to check before it is sent. */
    onpick: (files: File[]) => void;
  } = $props();

  const avatar = $derived(kind === 'avatar');
  let mounted = $state(false);
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
  onMount(() => (mounted = true));

  // A file can arrive without the modal (dropped on the page by a test, or picked before it
  // opened): the cropper still needs it open.
  let open = $state(false);
  $effect(() => {
    if (framing) open = true;
  });

  // The framed file, shown where the current image is until the form is saved.
  let picked = $state<File>();
  let pickedUrl = $state<string>();
  $effect(() => {
    if (!picked) return;
    const url = URL.createObjectURL(picked);
    pickedUrl = url;
    return () => {
      URL.revokeObjectURL(url);
      pickedUrl = undefined;
    };
  });
  const shown = $derived(pickedUrl ?? (currentUrl && !removed ? currentUrl : null));

  const accept = IMAGE_TYPES.join(',');
  const describedby = $derived([`${id}-hint`, error ? `${id}-error` : ''].join(' ').trim());
  // The size that is sent, so a picture of that shape needs no cutting.
  const recommended = $derived(avatar ? m.upload_recommended_photo : m.upload_recommended_table);
</script>

<div class="min-w-0">
  {#if mounted}
    <FileUpload
      {name}
      maxFiles={1}
      transformFiles={frame}
      ids={{ hiddenInput: id }}
      onFileChange={(details) => {
        picked = details.acceptedFiles[0];
        onpick(details.acceptedFiles);
      }}
      class="grid gap-2"
    >
      <FileUpload.Label class="label-text font-semibold">{label}</FileUpload.Label>
      <p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>
      <!-- A person's photo or a logo is shown by the page, in its own panel. -->
      {#if shown && !avatar}
        <img src={shown} alt="" class="aspect-5/2 w-full max-w-sm rounded-lg object-cover" />
      {/if}
      <div class="flex flex-wrap items-center gap-3">
        <ImageDialog
          bind:open
          onclose={() => finish([])}
          title={m.upload_image_title()}
          label={shown || (avatar && currentUrl) ? m.form_image_replace() : m.form_image_choose()}
          icon="image"
          triggerAttributes={{
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': describedby,
          }}
        >
          <div class="mt-5">
            <FileUpload.Dropzone
              class="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-primary-500 bg-surface-950-50/5 px-6 py-10 text-center data-dragging:bg-primary-500/10 {framing
                ? 'hidden'
                : ''}"
              aria-describedby="{id}-formats"
            >
              <Icon name="cloud-upload" size={32} class="text-primary-500" />
              <p class="font-semibold">{dropText ?? m.upload_drop()}</p>
            </FileUpload.Dropzone>
            {#if framing}
              <ImageCropper
                bare
                file={framing.file}
                aspectRatio={avatar ? 1 : 5 / 2}
                width={avatar ? 512 : 1200}
                round={avatar}
                onconfirm={(cropped) => {
                  finish([cropped]);
                  open = false;
                }}
                onreplace={() => finish([])}
                oncancel={() => (open = false)}
                onunreadable={() => {
                  finish([framing!.file]);
                  open = false;
                }}
              />
            {:else}
              <p id="{id}-formats" class="mt-3 text-sm text-muted">
                {m.upload_formats()}<br />{recommended()}
              </p>
            {/if}
          </div>
        </ImageDialog>
        {#if currentUrl && !avatar}
          {#if removed}
            <p role="status" class="text-sm font-semibold">{m.form_image_removed()}</p>
            <MAButton
              size="custom"
              type="button"
              class="btn h-12 rounded-lg px-3 font-semibold hover:preset-tonal"
              onclick={() => (removed = false)}>{m.form_image_undo_remove()}</MAButton
            >
            <input type="hidden" name="removeImage" value="true" />
          {:else}
            <MAButton
              size="custom"
              type="button"
              class="btn h-12 rounded-lg px-3 font-semibold text-error-alert hover:preset-tonal"
              onclick={() => (removed = true)}>{m.form_image_remove_current()}</MAButton
            >
          {/if}
        {/if}
      </div>
      <!-- `accept` here only narrows the picker; the schema decides what is refused. -->
      <FileUpload.HiddenInput {accept} />
      <FileUpload.ItemGroup class="grid gap-2">
        <FileUpload.Context>
          {#snippet children(upload)}
            {#each upload().acceptedFiles as file (file.name)}
              <FileUpload.Item
                {file}
                class="flex items-center gap-3 rounded-lg border border-surface-200-800 px-3 py-2 text-sm"
              >
                <FileUpload.ItemName class="min-w-0 grow truncate font-semibold"
                  >{file.name}</FileUpload.ItemName
                >
                <FileUpload.ItemSizeText class="shrink-0 text-muted"
                  >{upload().getFileSize(file)}</FileUpload.ItemSizeText
                >
                <FileUpload.ItemDeleteTrigger
                  class="btn size-11 shrink-0 rounded-lg hover:preset-tonal"
                  aria-label={m.form_image_remove({ name: file.name })}
                >
                  <Icon name="xmark" size={16} />
                </FileUpload.ItemDeleteTrigger>
              </FileUpload.Item>
            {/each}
          {/snippet}
        </FileUpload.Context>
      </FileUpload.ItemGroup>
    </FileUpload>
  {:else}
    <label for={id} class="label-text block font-semibold">{label}</label>
    <p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>
    <input
      {id}
      {name}
      type="file"
      {accept}
      class="mt-1 block w-full text-sm file:mr-3 file:h-12 file:rounded-lg file:border-2 file:border-surface-950-50 file:bg-transparent file:px-4 file:font-semibold"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedby}
    />
  {/if}
  <FieldError {id} message={error} />
</div>
