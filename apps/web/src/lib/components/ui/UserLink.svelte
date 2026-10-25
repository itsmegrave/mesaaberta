<script lang="ts">
  import { atHandle, NAMELESS } from '@mesaaberta/core/profile/handle';

  let {
    username,
    label,
    class: className = '',
  }: {
    username: string | null | undefined;
    label?: string;
    class?: string;
  } = $props();
</script>

{#if username && username !== NAMELESS}
  <a
    href={`/u/${encodeURIComponent(username)}`}
    class="relative z-10 rounded-sm hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {className}"
    >{label ?? atHandle(username)}</a
  >
{:else}
  <span class={className}>{label ?? atHandle(username)}</span>
{/if}
