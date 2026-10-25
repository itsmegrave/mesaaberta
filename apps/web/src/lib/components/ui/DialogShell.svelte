<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

  // The modal every dialog draws: a dimmed backdrop, a centred card (a bottom sheet on a phone with
  // `sheet`), its title and description, and what the caller puts under them. The caller owns
  // `open`; `defaultOpen` instead opens it on mount for a dialog that is mounted only while it asks.
  let {
    open = $bindable(false),
    defaultOpen = false,
    onOpenChange,
    role = 'dialog',
    size = 'md',
    scroll = false,
    sheet = false,
    lazy = true,
    initialFocusEl,
    trigger,
    triggerClass = '',
    triggerLabel,
    title,
    description,
    children,
  }: {
    open?: boolean;
    /** Uncontrolled: open from the moment it mounts, and drawn for as long as it is mounted. */
    defaultOpen?: boolean;
    /** After `open` follows the change. */
    onOpenChange?: (open: boolean) => void;
    /** `alertdialog` when it asks before taking something away. */
    role?: 'dialog' | 'alertdialog';
    size?: 'md' | 'lg';
    /** Scrolls inside the viewport when the content is taller than it. */
    scroll?: boolean;
    /** A bottom sheet on a phone, centred from `md` up. */
    sheet?: boolean;
    /**
     * Draws the positioner only while open. A closed one is a full-screen layer whose
     * `pointer-events: none` is an inline style, which the CSP blocks: it would cover the page.
     */
    lazy?: boolean;
    initialFocusEl?: () => HTMLElement | null;
    /** The content of its own trigger button; none when something else opens it. */
    trigger?: Snippet;
    triggerClass?: string;
    /** Names the trigger for screen readers when its content alone would not. */
    triggerLabel?: string;
    title: string | Snippet;
    description?: string | Snippet;
    children: Snippet;
  } = $props();

  const sizes = { md: 'max-w-md', lg: 'max-w-lg' };
</script>

<Dialog
  {...defaultOpen ? { defaultOpen: true } : { open }}
  onOpenChange={(details) => {
    open = details.open;
    onOpenChange?.(details.open);
  }}
  {role}
  {initialFocusEl}
>
  {#if trigger}
    <Dialog.Trigger class={triggerClass} aria-label={triggerLabel}
      >{@render trigger()}</Dialog.Trigger
    >
  {/if}
  {#if open || !lazy || defaultOpen}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner
        class="fixed inset-0 z-50 flex justify-center {sheet
          ? 'items-end md:items-center md:p-4'
          : 'items-center p-4'}"
      >
        <Dialog.Content
          class="w-full {sizes[
            size
          ]} card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl {scroll
            ? 'max-h-full overflow-y-auto'
            : ''} {sheet ? 'rounded-b-none pb-8 md:rounded-b-lg md:pb-6' : ''}"
        >
          <Dialog.Title class="text-xl font-semibold"
            >{#if typeof title === 'string'}{title}{:else}{@render title()}{/if}</Dialog.Title
          >
          {#if description}
            <Dialog.Description class="mt-2 text-surface-700-300"
              >{#if typeof description === 'string'}{description}{:else}{@render description()}{/if}</Dialog.Description
            >
          {/if}
          {@render children()}
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  {/if}
</Dialog>
