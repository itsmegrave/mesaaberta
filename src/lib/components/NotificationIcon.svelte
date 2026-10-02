<script lang="ts">
  import type { IconName } from '$lib/icons/names';
  import type { NotificationIcon } from '$lib/notifications/kinds';
  import Icon from './Icon.svelte';

  let {
    icon,
    size = 20,
    class: className = '',
  }: { icon: NotificationIcon; size?: number; class?: string } = $props();

  // A notification's icon name (stored on the row) and the icon that draws it.
  const ICONS: Record<NotificationIcon, IconName> = {
    calendar: 'calendar',
    cancel: 'circle-x',
    'user-plus': 'user-plus',
    'user-check': 'user-check',
    'user-x': 'user-x',
    'user-minus': 'user-minus',
    star: 'star',
    tag: 'tag',
    shield: 'shield',
    megaphone: 'megaphone',
    wrench: 'wrench',
    'alert-triangle': 'triangle-alert',
    sparkles: 'sparkles',
    gift: 'gift',
    info: 'info',
    message: 'game-icons:scroll-quill',
  };
</script>

<Icon name={ICONS[icon] ?? 'megaphone'} {size} class={className} />
