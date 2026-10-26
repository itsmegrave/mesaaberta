<script lang="ts">
  /**
   * A directory with nothing to show for what was asked: what is missing, a hint, and one link to
   * act on it, in a washed box. Announced, since it replaces a list that just changed.
   */
  let {
    title,
    hint,
    href,
    action,
    class: className = '',
  }: { title: string; hint?: string; href?: string; action?: string; class?: string } = $props();
</script>

<div
  role="status"
  class="{className} flex flex-col items-start gap-2 rounded-lg bg-surface-wash p-6 md:p-8"
>
  <p class="text-lg font-semibold md:text-xl">{title}</p>
  {#if hint}<p class="text-muted">{hint}</p>{/if}
  {#if href && action}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
    <a {href} class="font-semibold text-link underline underline-offset-4">{action}</a>
  {/if}
</div>
