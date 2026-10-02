<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  let {
    value = $bindable(''),
    element = $bindable(),
    class: className = 'textarea w-full rounded-lg border-surface-200-800 px-3 py-3',
    ...attributes
  }: HTMLTextareaAttributes & { element?: HTMLTextAreaElement } = $props();
</script>

<textarea bind:this={element} bind:value {...attributes} class={className}></textarea>
