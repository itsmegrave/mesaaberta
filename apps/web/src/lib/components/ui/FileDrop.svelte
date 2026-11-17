<script lang="ts">
  // One file for a form, picked on the page itself: a drop zone while nothing is picked, then the
  // file's preview (an image or a video), its name and size, with "Trocar arquivo" and a button that
  // takes it off. The file travels in the form's own field (`name`), sent with the rest of the form;
  // resetting the form empties it. The type and the size are checked by whoever takes the form, so
  // every problem reads the same way; `accept` only narrows the picker. A picture that needs framing
  // uses ImageUpload instead.
  import { FileUpload, useFileUpload } from '@skeletonlabs/skeleton-svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    id,
    name,
    label,
    hint,
    formats,
    accept,
    required = false,
    error,
    dropText,
    onpick,
  }: {
    id: string;
    name: string;
    label: string;
    hint?: string;
    /** The kinds and the limit, under the drop zone's text ("JPEG ou MP4 · até 20 MB"). */
    formats?: string;
    /** MIME types or extensions, as in the file field's `accept`. */
    accept?: string;
    required?: boolean;
    error?: string;
    /** What the drop zone says; "Arraste o arquivo para cá ou clique para escolher" by default. */
    dropText?: string;
    /** The file picked, or none once it is taken off. */
    onpick?: (file: File | undefined) => void;
  } = $props();

  const uploadId = $props.id();
  const upload = useFileUpload(() => ({
    id: uploadId,
    name,
    accept,
    required,
    invalid: Boolean(error),
    maxFiles: 1,
    ids: { hiddenInput: id },
    onFileChange: (details) => onpick?.(details.acceptedFiles[0]),
  }));

  const file = $derived(upload().acceptedFiles[0]);
  const video = $derived(file?.type.startsWith('video/') ?? false);
  const image = $derived(file?.type.startsWith('image/') ?? false);

  // The preview reads the picked file from a blob URL, let go of when the file changes.
  let preview = $state<string>();
  $effect(() => {
    if (!file || !(video || image)) return;
    const url = URL.createObjectURL(file);
    preview = url;
    return () => {
      URL.revokeObjectURL(url);
      preview = undefined;
    };
  });

  // `form.reset()` (after a post, say) empties the field; the picked file goes with it.
  let field = $state<HTMLElement>();
  $effect(() => {
    const form = field?.closest('form');
    if (!form) return;
    const clear = () => upload().clearFiles();
    form.addEventListener('reset', clear);
    return () => form.removeEventListener('reset', clear);
  });

  const describedby = $derived(
    [hint ? `${id}-hint` : '', formats ? `${id}-formats` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined,
  );
</script>

<div class="min-w-0" bind:this={field}>
  <FileUpload.Provider value={upload} class="grid gap-2">
    <FileUpload.Label class="label-text font-semibold">{label}</FileUpload.Label>
    {#if hint}<p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>{/if}
    {#if file}
      <div
        class="grid gap-3 rounded-lg border border-surface-200-800 bg-surface-50-950 p-3 sm:grid-cols-[auto_1fr] sm:items-center"
      >
        <!-- 160px wide previews: big enough to recognise the post, small enough to keep the form short. -->
        {#if preview && video}
          <video
            src={preview}
            controls
            muted
            playsinline
            preload="metadata"
            aria-label={m.file_drop_preview({ name: file.name })}
            class="max-h-60 w-full rounded-md bg-surface-950 object-contain sm:w-40"
          ></video>
        {:else if preview}
          <img
            src={preview}
            alt=""
            class="max-h-60 w-full rounded-md bg-surface-950 object-contain sm:w-40"
          />
        {/if}
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div class="grid min-w-0 grow gap-1">
            <p class="truncate font-semibold">{file.name}</p>
            <p class="text-sm text-muted">{upload().getFileSize(file)}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <FileUpload.Trigger
              class={buttonClass('secondary')}
              aria-describedby={describedby}
            >
              <Icon name="upload" size={18} />{m.file_drop_replace()}
            </FileUpload.Trigger>
            <FileUpload.ClearTrigger
              class="{buttonClass('ghost', 'icon')} hover:preset-tonal"
              aria-label={m.form_image_remove({ name: file.name })}
            >
              <Icon name="xmark" size={18} />
            </FileUpload.ClearTrigger>
          </div>
        </div>
      </div>
    {:else}
      <FileUpload.Dropzone
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors hover:bg-primary-500/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 data-dragging:bg-primary-500/10 {error
          ? 'border-error-500'
          : 'border-primary-500'}"
        aria-describedby={describedby}
        aria-invalid={error ? 'true' : undefined}
      >
        <Icon name="cloud-upload" size={32} class="text-primary-500" />
        <p class="font-semibold">{dropText ?? m.file_drop_text()}</p>
        {#if formats}<p id="{id}-formats" class="text-sm text-muted">{formats}</p>{/if}
      </FileUpload.Dropzone>
    {/if}
    <FileUpload.HiddenInput />
  </FileUpload.Provider>
  <FieldError {id} message={error} />
</div>
