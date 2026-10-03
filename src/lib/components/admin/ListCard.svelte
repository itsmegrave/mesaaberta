<script lang="ts">
  // A row of an admin list on a phone: media, a title that links, the meta lines, the badges and, at
  // the end, the row's KebabMenu. Rows share one list inside a bordered card, as the table does.
  import type { Snippet } from 'svelte';

  let {
    media,
    title,
    meta,
    badges,
    action,
  }: {
    media?: Snippet;
    /** The title, usually a link: the row stays one tap target for the page it opens. */
    title: Snippet;
    /** One or two muted lines under the title. */
    meta?: Snippet;
    badges?: Snippet;
    /** The KebabMenu, or the link that opens the row. */
    action?: Snippet;
  } = $props();
</script>

<li class="flex min-h-17 items-start gap-3 px-4 py-3">
  {#if media}<div class="pt-0.5">{@render media()}</div>{/if}
  <div class="min-w-0 flex-1">
    <div class="truncate font-semibold">{@render title()}</div>
    {#if meta}<div class="mt-0.5 text-sm text-muted">{@render meta()}</div>{/if}
    {#if badges}<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {@render badges()}
      </div>{/if}
  </div>
  {#if action}<div class="-mr-2 shrink-0">{@render action()}</div>{/if}
</li>
