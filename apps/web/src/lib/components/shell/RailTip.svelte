<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';

  // The rail shows icons only: this names the item in a tooltip to its right, on hover and on
  // keyboard focus. It wraps the item, so links, the bell's popover and the account menu keep
  // their own triggers. The card is built only while open: a closed positioner would put an
  // inline `style` on the page, which the CSP refuses. Off (the open sidebar), it is just the item.
  let {
    label,
    enabled = true,
    children,
  }: {
    /** The item's full name. */
    label: string;
    enabled?: boolean;
    children: Snippet;
  } = $props();

  let open = $state(false);

  // Focus does not bubble to the wrapper, and a click or a closing popover also moves focus, so
  // only keyboard focus opens it.
  function onfocusin(event: FocusEvent) {
    if ((event.target as HTMLElement).matches(':focus-visible')) open = true;
  }
</script>

{#if enabled}
  <Tooltip
    {open}
    onOpenChange={(details) => (open = details.open)}
    openDelay={300}
    closeDelay={0}
    positioning={{ placement: 'right', offset: { mainAxis: 24 } }}
  >
    <Tooltip.Trigger>
      {#snippet element(attributes)}
        <span
          {...attributes as Record<string, unknown>}
          class="flex"
          {onfocusin}
          onfocusout={() => (open = false)}
        >
          {@render children()}
        </span>
      {/snippet}
    </Tooltip.Trigger>
    {#if open}
      <Portal>
        <Tooltip.Positioner class="z-50!">
          <Tooltip.Content
            class="card border border-surface-200-800 bg-surface-100-900 px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap shadow-xl"
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    {/if}
  </Tooltip>
{:else}
  {@render children()}
{/if}
