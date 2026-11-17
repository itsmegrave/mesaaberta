<script module lang="ts">
  /** A row of the manage page's lists: its own tile on the wash, as on the ManageTable board. */
  export const rosterRowClass =
    'flex items-center justify-between gap-3 rounded-lg bg-surface-wash px-4 py-2';
  /** A row that has to stand out from a washed section (a request): the panel and its line. */
  export const rosterRowPanelClass =
    'flex items-center justify-between gap-3 rounded-lg border border-surface-200-800 bg-panel px-4 py-2';
  /** On the list that holds the rows. */
  export const rosterListClass = 'flex flex-col gap-2';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';

  // A person on a table's roster (a request, the GM, a player): the photo, the name and a line
  // under it, then what can be done about them. `children` follows on a line of its own (a
  // request's message, with `wrap`). `extra` goes under the line (a request's score).
  let {
    username,
    avatarUrl,
    subline,
    panel = false,
    wrap = false,
    extra,
    actions,
    children,
  }: {
    username: string | null;
    avatarUrl: string | null;
    subline: string;
    /** Stand out from a washed section, as a request does. */
    panel?: boolean;
    wrap?: boolean;
    extra?: Snippet;
    actions?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<li class="{panel ? rosterRowPanelClass : rosterRowClass} {wrap ? 'flex-wrap' : ''}">
  <span class="flex min-w-0 items-center gap-3">
    <MAAvatar src={avatarUrl} name={username} size={48} />
    <span class="min-w-0">
      <span class="block truncate font-semibold"><UserLink {username} /></span>
      <span class="block text-sm text-muted">{subline}</span>
      {#if extra}<span class="mt-1 block">{@render extra()}</span>{/if}
    </span>
  </span>
  {@render actions?.()}
  {@render children?.()}
</li>
