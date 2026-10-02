<script lang="ts">
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { atHandle, NAMELESS } from '$lib/profile/handle';

  let {
    username,
    label,
    class: className = '',
  }: {
    username: string | null | undefined;
    label?: string;
    class?: string;
  } = $props();
  const locale = getLocale();
</script>

{#if username && username !== NAMELESS}
  <a
    href={localizedHref(`/${encodeURIComponent(username)}`, locale)}
    class="relative z-10 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {className}"
    >{label ?? atHandle(username)}</a
  >
{:else}
  <span class={className}>{label ?? atHandle(username)}</span>
{/if}
