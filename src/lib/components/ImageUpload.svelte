<script lang="ts">
  // The table's image: Skeleton's File Upload, a zone to drop a file on or a button to pick one.
  // Until JavaScript runs it is a plain file field, so the form works without it. The type and the
  // size are checked by the form's schema, not here, so every problem reads the same way.
  import { FileUpload } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { IMAGE_TYPES } from '$lib/forms/files';
  import { m } from '$lib/paraglide/messages';

  let {
    id,
    name,
    label,
    hint,
    error,
    currentUrl = null,
    removed = $bindable(false),
    onpick,
  }: {
    id: string;
    name: string;
    label: string;
    hint: string;
    error?: string;
    /** The image the table has now, shown above the zone. */
    currentUrl?: string | null;
    /** The current image is to be taken off on save (sent as `removeImage`). */
    removed?: boolean;
    /** The file picked (or none, once removed), for the form to check before it is sent. */
    onpick: (files: File[]) => void;
  } = $props();

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const accept = IMAGE_TYPES.join(',');
  const describedby = $derived([`${id}-hint`, error ? `${id}-error` : ''].join(' ').trim());
</script>

<div class="min-w-0">
  {#if currentUrl && !removed}
    <img src={currentUrl} alt="" class="aspect-5/2 w-full max-w-sm rounded-lg object-cover" />
  {/if}
  {#if currentUrl && mounted}
    <div class="mt-2 mb-3 flex flex-wrap items-center gap-3">
      {#if removed}
        <p role="status" class="text-sm font-semibold">{m.form_image_removed()}</p>
        <button
          type="button"
          class="btn h-11 rounded-lg px-3 font-semibold hover:preset-tonal"
          onclick={() => (removed = false)}>{m.form_image_undo_remove()}</button
        >
        <input type="hidden" name="removeImage" value="true" />
      {:else}
        <button
          type="button"
          class="btn h-11 rounded-lg px-3 font-semibold text-error-alert hover:preset-tonal"
          onclick={() => (removed = true)}>{m.form_image_remove_current()}</button
        >
      {/if}
    </div>
  {:else if currentUrl}
    <label class="mt-2 mb-3 flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name="removeImage" value="true" class="checkbox" />
      {m.form_image_remove_current()}
    </label>
  {/if}
  {#if mounted}
    <FileUpload
      {name}
      maxFiles={1}
      ids={{ hiddenInput: id }}
      onFileChange={(details) => onpick(details.acceptedFiles)}
      class="grid gap-2"
    >
      <FileUpload.Label class="label-text font-semibold">{label}</FileUpload.Label>
      <p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>
      <FileUpload.Dropzone
        class="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-surface-400-600 bg-surface-950-50/5 p-6 text-center data-dragging:border-primary-500 data-dragging:bg-primary-500/10"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="text-muted"
          ><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path
            d="M21 16l-5-5-9 9"
          /></svg
        >
        <p class="text-sm">{m.form_image_drop()}</p>
        <FileUpload.Trigger
          class="btn h-11 rounded-lg border-2 border-surface-950-50 px-4 font-semibold hover:preset-tonal"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedby}
          >{currentUrl && !removed
            ? m.form_image_replace()
            : m.form_image_choose()}</FileUpload.Trigger
        >
      </FileUpload.Dropzone>
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
                <FileUpload.ItemName class="min-w-0 grow truncate font-semibold" />
                <FileUpload.ItemSizeText class="shrink-0 text-muted" />
                <FileUpload.ItemDeleteTrigger
                  class="btn size-9 shrink-0 rounded-lg hover:preset-tonal"
                  aria-label={m.form_image_remove({ name: file.name })}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
                  >
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
      class="mt-1 block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-2 file:border-surface-950-50 file:bg-transparent file:px-4 file:font-semibold"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedby}
    />
  {/if}
  {#if error}<p id="{id}-error" role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
      {error}
    </p>{/if}
</div>
