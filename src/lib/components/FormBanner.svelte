<script lang="ts">
  /**
   * What a form says above its fields: the sentence for the action message, which each form
   * picks from its codes. A problem is an alert (read at once); a success is a status (read when
   * the reader is free). Nothing is rendered without a text.
   */
  let {
    text,
    tone = 'error',
    class: className = '',
  }: { text: string | null | undefined; tone?: 'error' | 'success'; class?: string } = $props();
</script>

{#if text}
  {#if tone === 'error'}
    <p role="alert" class="font-semibold text-error-700-300 {className}">{text}</p>
  {:else}
    <p role="status" class="font-semibold text-success-700-300 {className}">{text}</p>
  {/if}
{/if}
