<script lang="ts">
  import { cleanRichHtml } from '$lib/text/rich';
  import './rich-text.css';

  /** Rich text as the HTML subset of `$lib/text/rich`: a GM's description, a welcome message. */
  let { html, class: className = '' }: { html: string; class?: string } = $props();

  // Cleaned again here, whatever the database holds, so nothing that reaches the page can run code.
  const safe = $derived(cleanRichHtml(html));
</script>

{#if safe}
  <div class="rich-text {className}">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- the only {@html}: `safe` went through cleanRichHtml's allowlist -->
    {@html safe}
  </div>
{/if}
