<script lang="ts">
  /** A list with nothing to show, announced; with filters on, a link back to the whole list. */
  let { text, clearHref, clearLabel }: { text: string; clearHref?: string; clearLabel?: string } =
    $props();
</script>

<div class="mt-10 max-w-sm" role="status">
  <p class="text-lg">{text}</p>
  {#if clearHref && clearLabel}
    <a href={clearHref} class="mt-3 inline-block anchor">{clearLabel}</a>
  {/if}
</div>
