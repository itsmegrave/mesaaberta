<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Long-form reading text (legal pages, the changelog): headings, paragraphs, lists and links. */
  let { children, class: className = '' }: { children: Snippet; class?: string } = $props();
</script>

<div class={className}>
  {@render children()}
</div>

<style>
  /* Rendered Markdown and hand-written prose share these rules, so they live in one place. */
  div :global(h2) {
    margin-top: 2.5rem;
    font-size: 1.5rem;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  div :global(h3) {
    margin-top: 1.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }
  div :global(p),
  div :global(ul) {
    margin-top: 0.875rem;
    line-height: 1.7;
  }
  div :global(ul) {
    list-style: disc;
    padding-left: 1.5rem;
  }
  div :global(li + li) {
    margin-top: 0.375rem;
  }
  div :global(a) {
    font-weight: 600;
    text-decoration-line: underline;
    text-decoration-color: var(--color-primary-500);
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }
</style>
