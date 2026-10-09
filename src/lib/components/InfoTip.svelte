<script lang="ts">
  // A small "i" button beside a label that explains something in a sentence. It opens on hover and
  // focus, and a tap toggles it, since touch screens have no hover. Esc closes it.
  import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages';

  let { text, label = m.info_tip_label() }: { text: string; label?: string } = $props();

  let open = $state(false);
</script>

<Tooltip
  {open}
  onOpenChange={(details) => (open = details.open)}
  closeOnClick={false}
  positioning={{ placement: 'top' }}
>
  <Tooltip.Trigger
    type="button"
    aria-label={label}
    onclick={() => (open = !open)}
    class="inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-full text-muted hover:text-surface-950-50 focus-visible:outline-2 focus-visible:outline-primary-500"
  >
    <Icon name="info" size={16} />
  </Tooltip.Trigger>
  {#if open}
    <Portal>
      <Tooltip.Positioner class="z-50!">
        <Tooltip.Content
          class="max-w-72 card border border-surface-200-800 bg-surface-100-900 p-3 text-sm shadow-2xl"
        >
          {text}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Portal>
  {/if}
</Tooltip>
