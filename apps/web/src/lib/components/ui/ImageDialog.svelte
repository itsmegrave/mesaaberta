<script lang="ts">
  // The modal an image is picked and framed in (UploadDialog for the photo and the cover,
  // ImageUpload for a table's, a partner's or a campaign's image): a button opens it, the drop zone
  // and then the cropper go inside. A bottom sheet on a phone, a wide card from `md` up, so the
  // crop area has room. The caller owns `open` and lets go of the picked file when it closes.
  import { untrack, type Snippet } from 'svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    open = $bindable(false),
    onclose,
    title,
    label,
    icon,
    triggerClass = 'btn h-11 w-full gap-2 rounded-lg btn-secondary px-4 font-semibold sm:w-auto',
    triggerAttributes = {},
    children,
  }: {
    open?: boolean;
    /** Every way it closes: the close button, Esc, the backdrop, or the caller setting `open`. */
    onclose?: () => void;
    title: string;
    /** The trigger's words. */
    label: string;
    icon?: IconName;
    triggerClass?: string;
    /** Extra attributes on the trigger (its description, its invalid state). */
    triggerAttributes?: Record<string, string | undefined>;
    children: Snippet;
  } = $props();

  // Heard however it closes, the caller's own `open = false` included.
  let shown = false;
  $effect(() => {
    if (shown && !open) untrack(() => onclose?.());
    shown = open;
  });
</script>

<Dialog {open} onOpenChange={(details) => (open = details.open)}>
  <Dialog.Trigger class={triggerClass} {...triggerAttributes}
    >{#if icon}<Icon name={icon} size={20} />{/if}{label}</Dialog.Trigger
  >
  <!-- Built when it opens: a closed dialog would put an inline `style` on the page. -->
  {#if open}<Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner
        class="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      >
        <Dialog.Content
          class="max-h-full w-full max-w-2xl overflow-y-auto card rounded-b-none border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl md:rounded-b-lg"
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
          {@render children()}
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>{/if}
</Dialog>
