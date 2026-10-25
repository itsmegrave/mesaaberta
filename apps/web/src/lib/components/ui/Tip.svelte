<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';

  // A button that explains itself in a small card: on hover and focus, and a tap toggles it, since
  // touch screens have no hover. Esc closes it. The card is built only while open: a closed
  // positioner would put an inline `style` on the page, which the CSP refuses.
  let {
    open = $bindable(false),
    placement = 'top',
    label,
    triggerClass = '',
    trigger,
    children,
  }: {
    open?: boolean;
    placement?: 'top' | 'bottom';
    /** The trigger's name for screen readers. */
    label: string;
    triggerClass?: string;
    trigger: Snippet;
    children: Snippet;
  } = $props();
</script>

<Tooltip
  {open}
  onOpenChange={(details) => (open = details.open)}
  closeOnClick={false}
  positioning={{ placement }}
>
  <Tooltip.Trigger
    type="button"
    aria-label={label}
    onclick={() => (open = !open)}
    class={triggerClass}
  >
    {@render trigger()}
  </Tooltip.Trigger>
  {#if open}
    <Portal>
      <Tooltip.Positioner class="z-50!">
        <Tooltip.Content
          class="max-w-72 card border border-surface-200-800 bg-surface-100-900 p-3 text-sm shadow-2xl"
        >
          {@render children()}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Portal>
  {/if}
</Tooltip>
