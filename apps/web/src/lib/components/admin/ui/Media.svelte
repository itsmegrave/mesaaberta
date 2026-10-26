<script lang="ts">
  // What sits before the title of a list row: a table's cover (56×36), a person's picture, or an icon
  // in a tile (a report, a notification, a decision). Decorative: the title beside it names the row.
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';

  let {
    kind,
    src = null,
    name = null,
    icon = 'game-icons:tavern-sign',
    size = 36,
    tone = 'quiet',
  }: {
    kind: 'cover' | 'avatar' | 'icon';
    src?: string | null;
    name?: string | null;
    icon?: IconName;
    size?: 36 | 40;
    /** An icon tile that marks something waiting takes the lamp. */
    tone?: 'quiet' | 'lamp';
  } = $props();
</script>

{#if kind === 'avatar'}
  <MAAvatar {src} {name} {size} />
{:else if kind === 'cover'}
  <!-- Calculated: the cover keeps its 14:9 shape (56×36) next to a two-line title. -->
  {#if src}
    <img {src} alt="" loading="lazy" class="h-9 w-14 shrink-0 rounded-md object-cover" />
  {:else}
    <span
      aria-hidden="true"
      class="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-surface-wash text-muted"
      ><Icon name={icon} size={20} /></span
    >
  {/if}
{:else}
  <span
    aria-hidden="true"
    class="flex shrink-0 items-center justify-center rounded-lg {tone === 'lamp'
      ? 'bg-lamp-wash text-lamp'
      : 'bg-surface-wash text-muted'} {size === 40 ? 'size-10' : 'size-9'}"
    ><Icon name={icon} size={20} /></span
  >
{/if}
