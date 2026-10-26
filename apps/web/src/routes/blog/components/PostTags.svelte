<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';

  /** A post's subjects, as quiet chips. */
  let { tags, class: className = '' }: { tags: string[]; class?: string } = $props();
</script>

{#if tags.length}
  <ul class="flex flex-wrap gap-2 {className}" aria-label={m.blog_tags()}>
    {#each tags as tag (tag)}
      <li
        class="inline-flex h-6 items-center rounded-full bg-surface-wash px-2 text-xs font-semibold"
      >
        {tag}
      </li>
    {/each}
  </ul>
{/if}
