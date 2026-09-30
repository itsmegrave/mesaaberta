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
  {:else if icon === 'wrench'}
    <path
      d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"
    />
  {:else if icon === 'alert-triangle'}
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  {:else if icon === 'sparkles'}
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  {:else if icon === 'gift'}
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  {:else if icon === 'info'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  {:else}
    <path d="M3 11v3a1 1 0 0 0 1 1h3l6 5V5L7 10H4a1 1 0 0 0-1 1z" />
    <path d="M17 9a4 4 0 0 1 0 6" />
  {/if}
</svg>
