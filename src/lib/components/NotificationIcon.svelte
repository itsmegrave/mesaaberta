<script lang="ts">
  import type { NotificationIcon } from '$lib/notifications/kinds';

  let {
    icon,
    size = 20,
    class: className = '',
  }: { icon: NotificationIcon; size?: number; class?: string } = $props();

  const person = 'M2 21a7 7 0 0 1 14 0';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class="shrink-0 {className}"
>
  {#if icon === 'calendar'}
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  {:else if icon === 'cancel'}
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-6 6M9 9l6 6" />
  {:else if icon === 'user-plus'}
    <circle cx="9" cy="8" r="4" />
    <path d="{person}M19 8v6M16 11h6" />
  {:else if icon === 'user-check'}
    <circle cx="9" cy="8" r="4" />
    <path d="{person}M16 11l2 2 4-4" />
  {:else if icon === 'user-x'}
    <circle cx="9" cy="8" r="4" />
    <path d="{person}M17 9l4 4M21 9l-4 4" />
  {:else if icon === 'user-minus'}
    <circle cx="9" cy="8" r="4" />
    <path d="{person}M16 11h6" />
  {:else if icon === 'star'}
    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />
  {:else if icon === 'tag'}
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  {:else if icon === 'shield'}
    <path d="M12 3l7 3v5.5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V6l7-3z" />
  {:else}
    <path d="M3 11v3a1 1 0 0 0 1 1h3l6 5V5L7 10H4a1 1 0 0 0-1 1z" />
    <path d="M17 9a4 4 0 0 1 0 6" />
  {/if}
</svg>
