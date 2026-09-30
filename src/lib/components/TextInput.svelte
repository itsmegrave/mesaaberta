<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  let { class: className = '', ...attributes }: HTMLInputAttributes = $props();
</script>

<input
  {...attributes}
  class="input h-12 w-full rounded-lg border-surface-200-800 px-3 {className}"
/>
