<script lang="ts">
  // A small "i" button beside a label that explains something in a sentence. It opens on hover and
  // focus, and a tap toggles it, since touch screens have no hover. Esc closes it.
  import Icon from '#lib/components/ui/Icon.svelte';
  import Tip from '#lib/components/ui/Tip.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { text, label = m.info_tip_label() }: { text: string; label?: string } = $props();
</script>

<Tip
  {label}
  triggerClass="inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-full text-muted hover:text-surface-950-50 focus-visible:outline-2 focus-visible:outline-primary-500"
>
  {#snippet trigger()}<Icon name="info" size={16} />{/snippet}
  {text}
</Tip>
