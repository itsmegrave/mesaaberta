<script module lang="ts">
  /** A row of the manage page's lists, ruled off from the next. */
  export const rosterRowClass =
    'flex items-center justify-between gap-3 border-b border-surface-200-800 py-3 last:border-b-0';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';

  // A person on a table's roster (a request, the GM, a player): the photo, the name and a line
  // under it, then what can be done about them. `children` follows on a line of its own (a
  // request's message, with `wrap`).
  let {
    username,
    avatarUrl,
    subline,
    wrap = false,
    actions,
    children,
  }: {
    username: string | null;
    avatarUrl: string | null;
    subline: string;
    wrap?: boolean;
    actions?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<li class="{rosterRowClass} {wrap ? 'flex-wrap' : ''}">
  <span class="flex min-w-0 items-center gap-3">
    <MAAvatar src={avatarUrl} name={username} size={40} />
    <span class="min-w-0">
      <span class="block truncate font-semibold"><UserLink {username} /></span>
      <span class="block text-sm text-muted">{subline}</span>
    </span>
  </span>
  {@render actions?.()}
  {@render children?.()}
</li>
