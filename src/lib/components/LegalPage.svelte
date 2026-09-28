<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    updated,
    children,
  }: { title: string; updated: { iso: string; label: string }; children: Snippet } = $props();
</script>

<article class="legal mx-auto max-w-[68ch] py-8 md:py-14">
  <h1
    class="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-[56px]"
  >
    {title}
  </h1>
  <p class="mt-3 text-muted">
    Última atualização: <time datetime={updated.iso}>{updated.label}</time>
  </p>
  <div class="mt-8 md:mt-10">
    {@render children()}
  </div>
</article>

<style>
  /* Long-form reading: the legal text is plain prose, so these rules keep it in one place. */
  .legal :global(h2) {
    margin-top: 2.5rem;
    font-size: 1.5rem;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .legal :global(h3) {
    margin-top: 1.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }
  .legal :global(p),
  .legal :global(ul) {
    margin-top: 0.875rem;
    line-height: 1.7;
  }
  .legal :global(ul) {
    list-style: disc;
    padding-left: 1.5rem;
  }
  .legal :global(li + li) {
    margin-top: 0.375rem;
  }
  .legal :global(a) {
    font-weight: 600;
    text-decoration-line: underline;
    text-decoration-color: var(--color-primary-500);
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }
</style>
