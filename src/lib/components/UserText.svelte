<script lang="ts">
  import UserLink from './UserLink.svelte';
  import { atHandle } from '$lib/profile/handle';

  // Keep translated sentence order while making only its interpolated identity a link.
  let {
    text,
    username,
    label,
  }: {
    text: string;
    username: string | null | undefined;
    label?: string;
  } = $props();
  const name = $derived(label ?? atHandle(username));
  const start = $derived(username ? text.indexOf(name) : -1);
</script>

{#if start >= 0}
  {text.slice(0, start)}<UserLink {username} label={name} />{text.slice(start + name.length)}
{:else}
  {text}
{/if}
