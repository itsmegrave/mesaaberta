<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  // Frames a picked image before it is sent: drag to move, zoom with the buttons, the mouse wheel
  // or a pinch, or nudge with the arrow keys and +/- once the frame has focus. Cropper.js does the
  // drawing (its styles go through the CSSOM, which the CSP allows); what leaves is one new file,
  // already cut to the shape and reduced, so the upload is small and the server keeps judging it as
  // any other image. Nothing here runs without JavaScript: the plain file field is the fallback.
  // Loaded when the dialog opens: the library touches `HTMLElement` as it is imported, which does not
  // exist while the server renders a page that can open this dialog.
  import type Cropper from 'cropperjs';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { onDestroy, onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { encodeImage } from '$lib/forms/encode-image';
  import { m } from '$lib/paraglide/messages';

  let {
    file,
    aspectRatio = 1,
    width = 512,
    round = false,
    onconfirm,
    oncancel,
    onunreadable,
  }: {
    /** The picture chosen, before any framing. */
    file: File;
    /** Width over height of the frame: 1 for a profile picture, the card's for a table's image. */
    aspectRatio?: number;
    /** Width of the file that is sent, in pixels. The height follows from the ratio. */
    width?: number;
    /** Shows the preview as a circle, for pictures that are drawn round. */
    round?: boolean;
    onconfirm: (cropped: File) => void;
    oncancel: () => void;
    /** The file is not a picture the browser can draw: the form should send it as it is. */
    onunreadable?: () => void;
  } = $props();

  let stage = $state<HTMLDivElement>();
  let image = $state<HTMLImageElement>();
  let preview = $state<HTMLDivElement>();
  let cropper: Cropper | undefined;
  let url = $state('');
  let failed = $state(false);
  let busy = $state(false);

  const extensions: Record<string, string> = {
    'image/webp': 'webp',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };

  onMount(() => {
    url = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(url);
  });

  $effect(() => {
    if (!image || !stage || !preview || !url) return;
    let instance: Cropper | undefined;
    let gone = false;
    void import('cropperjs').then(({ default: Library }) => {
      if (gone || !image || !stage || !preview) return;
      instance = new Library(image, { container: stage });
      frame(instance, preview);
    });
    return () => {
      gone = true;
      instance?.element?.remove?.();
      cropper = undefined;
    };
  });

  function frame(instance: Cropper, preview: HTMLDivElement) {
    cropper = instance;
    const canvas = instance.getCropperCanvas();
    const selection = instance.getCropperSelection();
    if (!canvas || !selection) return;
    canvas.classList.add('h-72', 'w-full');
    canvas.setAttribute('aria-label', m.image_crop_area());
    selection.aspectRatio = aspectRatio;
    selection.initialAspectRatio = aspectRatio;
    selection.initialCoverage = 0.9;
    selection.keyboard = true;
    selection.setAttribute('tabindex', '0');
    selection.id = 'image-crop-selection';
    const viewer = document.createElement('cropper-viewer');
    viewer.setAttribute('selection', '#image-crop-selection');
    // Cropper.js's own preview element has to be placed by hand; Svelte doesn't know it.
    preview.replaceChildren(viewer);
  }

  const zoom = (by: number) => cropper?.getCropperImage()?.$zoom(by);

  async function confirm() {
    const selection = cropper?.getCropperSelection();
    if (!selection || busy) return;
    busy = true;
    failed = false;
    try {
      const canvas = await selection.$toCanvas({ width });
      const blob = await encodeImage(canvas);
      if (!blob) throw new Error('too big');
      const base = file.name.replace(/\.[^.]+$/, '') || 'imagem';
      onconfirm(
        new File([blob], `${base}.${extensions[blob.type] ?? 'webp'}`, { type: blob.type }),
      );
    } catch {
      failed = true;
    } finally {
      busy = false;
    }
  }

  onDestroy(() => cropper?.element?.remove?.());
</script>

<Dialog
  defaultOpen
  onOpenChange={(details) => {
    if (!details.open) oncancel();
  }}
>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content
        class="max-h-full w-full max-w-lg overflow-y-auto card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
      >
        <Dialog.Title class="text-xl font-semibold">{m.image_crop_title()}</Dialog.Title>
        <Dialog.Description class="mt-2 text-surface-700-300"
          >{m.image_crop_hint()}</Dialog.Description
        >
        <div bind:this={stage} class="mt-4 overflow-hidden rounded-lg">
          <img bind:this={image} src={url} alt="" class="hidden" onerror={() => onunreadable?.()} />
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="custom"
            type="button"
            class="btn size-12 rounded-lg border-2 border-surface-200-800 hover:preset-tonal"
            aria-label={m.image_crop_zoom_out()}
            onclick={() => zoom(-0.1)}>−</Button
          >
          <Button
            size="custom"
            type="button"
            class="btn size-12 rounded-lg border-2 border-surface-200-800 hover:preset-tonal"
            aria-label={m.image_crop_zoom_in()}
            onclick={() => zoom(0.1)}><Icon name="plus" size={18} /></Button
          >
          <div class="ml-auto flex items-center gap-3">
            <span class="text-sm text-muted">{m.image_crop_preview()}</span>
            <div
              bind:this={preview}
              data-testid="crop-preview"
              class="size-20 overflow-hidden bg-surface-200-800 {round
                ? 'rounded-full'
                : 'rounded-lg'}"
            ></div>
          </div>
        </div>
        {#if failed}
          <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">
            {m.image_crop_failed()}
          </p>
        {/if}
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            size="custom"
            type="button"
            class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
            onclick={oncancel}>{m.image_crop_cancel()}</Button
          >
          <Button
            size="custom"
            type="button"
            class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
            disabled={busy}
            onclick={confirm}>{m.image_crop_use()}</Button
          >
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
