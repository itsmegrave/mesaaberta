<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  // Frames a picked image before it is sent: drag to move, zoom with the buttons, the mouse wheel
  // or a pinch, or nudge with the arrow keys and +/- once the frame has focus. Cropper.js does the
  // drawing (its styles go through the CSSOM, which the CSP allows); what leaves is one new file,
  // already cut to the shape and reduced, so the upload is small and the server keeps judging it as
  // any other image. Nothing here runs without JavaScript: the plain file field is the fallback.
  // Loaded when the dialog opens: the library touches `HTMLElement` as it is imported, which does not
  // exist while the server renders a page that can open this dialog.
  import type Cropper from 'cropperjs';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { onDestroy, onMount } from 'svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { encodeImage } from '#lib/forms/encode-image.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    file,
    aspectRatio = 1,
    width = 512,
    round = false,
    bare = false,
    onconfirm,
    oncancel,
    onreplace,
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
    /**
     * Drawn in place, without a dialog of its own: for a dialog that already holds the drop zone
     * (UploadDialog), which gives the title.
     */
    bare?: boolean;
    onconfirm: (cropped: File) => void;
    oncancel: () => void;
    /** Offers "Trocar imagem": back to picking another file. */
    onreplace?: () => void;
    /** The file is not a picture the browser can draw: the form should send it as it is. */
    onunreadable?: () => void;
  } = $props();

  let stage = $state<HTMLDivElement>();
  let image = $state<HTMLImageElement>();
  let preview = $state<HTMLDivElement>();
  let cropper: Cropper | undefined;
  // Settles once the frame has been fitted inside the picture, so a quick "Usar este recorte" can't
  // cut the library's first guess.
  let fitted: Promise<void> = Promise.resolve();
  let url = $state('');
  let failed = $state(false);
  let busy = $state(false);

  const extensions: Record<string, string> = {
    'image/webp': 'webp',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };

  type Box = { x: number; y: number; width: number; height: number };
  type CropperImage = NonNullable<ReturnType<Cropper['getCropperImage']>>;
  type CropperSelection = NonNullable<ReturnType<Cropper['getCropperSelection']>>;

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

  // Where an element sits inside the cropper's canvas.
  function place(element: Element, canvas: Element): Box {
    const box = element.getBoundingClientRect();
    const origin = canvas.getBoundingClientRect();
    return {
      x: box.left - origin.left,
      y: box.top - origin.top,
      width: box.width,
      height: box.height,
    };
  }

  // Half a pixel of slack for the browser's rounding of the picture's edges.
  const within = (inner: Box, outer: Box) =>
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5;

  // The largest frame of the ratio that fits in the picture, at 90%, in its middle.
  function centred(picture: Box): Box {
    let width = picture.width * 0.9;
    let height = width / aspectRatio;
    if (height > picture.height * 0.9) {
      height = picture.height * 0.9;
      width = height * aspectRatio;
    }
    return {
      x: picture.x + (picture.width - width) / 2,
      y: picture.y + (picture.height - height) / 2,
      width,
      height,
    };
  }

  // The frame never leaves the picture: a move, resize or zoom that would put empty canvas in the
  // cut is refused, so what is sent is all picture (no transparent or black bands at the edges).
  function confine(canvas: HTMLElement, picture: CropperImage, selection: CropperSelection) {
    let guarding = false;
    selection.addEventListener('change', (event) => {
      if (!guarding) return;
      const next = (event as CustomEvent<Box>).detail;
      if (!within(next, place(picture, canvas))) event.preventDefault();
    });
    picture.addEventListener('transform', (event) => {
      if (!guarding) return;
      const { matrix } = (event as CustomEvent<{ matrix: number[] }>).detail;
      // Measured as the library itself does: try the new matrix, read the box, put the old one back.
      const current = picture.style.transform;
      picture.style.transform = `matrix(${matrix.join(', ')})`;
      const next = place(picture, canvas);
      picture.style.transform = current;
      if (within(selection, next)) return;
      event.preventDefault();
      // The preview listens too and doesn't check for a refusal.
      event.stopImmediatePropagation();
    });
    return picture
      .$ready()
      .then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
      .then(() => {
        const { x, y, width, height } = centred(place(picture, canvas));
        selection.$change(x, y, width, height);
        guarding = true;
      })
      .catch(() => {});
  }

  function frame(instance: Cropper, preview: HTMLDivElement) {
    cropper = instance;
    const canvas = instance.getCropperCanvas();
    const selection = instance.getCropperSelection();
    const picture = instance.getCropperImage();
    if (!canvas || !selection || !picture) return;
    canvas.classList.add('h-48', 'w-full', 'sm:h-72');
    canvas.setAttribute('aria-label', m.image_crop_area());
    // Turning and skewing have no control here, and a turned picture can't be kept inside the frame.
    picture.rotatable = false;
    picture.skewable = false;
    selection.aspectRatio = aspectRatio;
    selection.initialAspectRatio = aspectRatio;
    selection.initialCoverage = 0.9;
    selection.precise = true;
    selection.keyboard = true;
    selection.setAttribute('tabindex', '0');
    selection.id = 'image-crop-selection';
    // Before the preview is made, so the guard hears each change first.
    fitted = confine(canvas, picture, selection);
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
      await fitted;
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

{#snippet controls()}
  <div bind:this={stage} class="mt-4 overflow-hidden rounded-lg">
    <img bind:this={image} src={url} alt="" class="hidden" onerror={() => onunreadable?.()} />
  </div>
  <div class="mt-4 flex flex-wrap items-center gap-3">
    <MAButton
      size="custom"
      type="button"
      class="btn size-12 rounded-lg btn-secondary"
      aria-label={m.image_crop_zoom_out()}
      onclick={() => zoom(-0.1)}>−</MAButton
    >
    <MAButton
      size="custom"
      type="button"
      class="btn size-12 rounded-lg btn-secondary"
      aria-label={m.image_crop_zoom_in()}
      onclick={() => zoom(0.1)}><Icon name="plus" size={18} /></MAButton
    >
    {#if onreplace}
      <MAButton
        size="custom"
        type="button"
        class="ml-auto btn h-12 rounded-lg btn-secondary px-4 font-semibold"
        onclick={onreplace}>{m.upload_replace()}</MAButton
      >
    {/if}
  </div>
  <!-- The viewer takes its height from its width and the frame's ratio: a square box for a square
       frame, a strip for a wide one. -->
  <div class="mt-4 flex items-center gap-3">
    <span class="text-sm text-muted">{m.image_crop_preview()}</span>
    <div
      bind:this={preview}
      data-testid="crop-preview"
      class="overflow-hidden bg-surface-200-800 {aspectRatio === 1 ? 'size-20' : 'w-40'} {round
        ? 'rounded-full'
        : 'rounded-lg'}"
    ></div>
  </div>
  {#if failed}
    <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">
      {m.image_crop_failed()}
    </p>
  {/if}
  <DialogActions
    class="mt-6"
    cancel={m.image_crop_cancel()}
    {oncancel}
    confirm={m.image_crop_use()}
    disabled={busy}
    onconfirm={confirm}
  />
{/snippet}

{#if bare}
  <div>
    <p class="text-sm text-surface-700-300">{m.image_crop_hint()}</p>
    {@render controls()}
  </div>
{:else}
  <DialogShell
    defaultOpen
    onOpenChange={(open) => {
      if (!open) oncancel();
    }}
    size="lg"
    scroll
    title={m.image_crop_title()}
    description={m.image_crop_hint()}
  >
    {@render controls()}
  </DialogShell>
{/if}
