<script lang="ts" module>
  import type { IconName } from '$lib/icons/names';

  export type KebabItem = {
    id: string;
    /** The words; a destructive item ends in "…" because it asks before doing it. */
    label: string;
    icon?: IconName;
    /** An address of the app (already localized) to go to. */
    href?: string;
    /** The file at `href` is downloaded rather than navigated to. */
    download?: boolean;
    onselect?: () => void;
    /** Red, and always last, after a rule. */
    destructive?: boolean;
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages';
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';

  /**
   * The "3 dots" menu for secondary and destructive actions: next to a page's title, and as the
   * whole actions column of a table or row. `name` says what it acts on ("Mais ações: Mesa do
   * Dragão").
   */
  let {
    name,
    items,
    placement = 'bottom-end',
    class: className = '',
  }: {
    name: string;
    items: KebabItem[];
    placement?: 'bottom-end' | 'bottom-start';
    class?: string;
  } = $props();

  // The menu's content is built when it opens: a closed one would put an inline `style` on the
  // page, which the CSP refuses.
  let open = $state(false);
  const regular = $derived(items.filter((item) => !item.destructive));
  const destructive = $derived(items.filter((item) => item.destructive));

  function select(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.disabled) return;
    item.onselect?.();
    if (!item.href) return;
    if (item.download) window.location.assign(item.href);
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- already resolved by localizedHref
    else void goto(item.href);
  }

  const row =
    'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold data-highlighted:preset-tonal data-disabled:opacity-50';
</script>

{#snippet entry(item: KebabItem)}
  <Menu.Item
    value={item.id}
    disabled={item.disabled}
    class="{row} {item.destructive ? 'text-error-700-300' : ''}"
  >
    {#if item.icon}<Icon name={item.icon} size={20} />{/if}
    <span class="min-w-0 flex-1">{item.label}</span>
  </Menu.Item>
{/snippet}

<Menu
  {open}
  onOpenChange={(details) => (open = details.open)}
  positioning={{ placement, offset: { mainAxis: 4 } }}
  onSelect={({ value }) => select(value)}
>
  <Menu.Trigger
    aria-label={m.kebab_label({ name })}
    class="btn inline-flex size-11 shrink-0 items-center justify-center rounded-lg p-0 hover:preset-tonal {className}"
  >
    <Icon name="more" size={20} />
  </Menu.Trigger>
  {#if open}<Portal>
      <Menu.Positioner class="z-50!">
        <Menu.Content
          class="w-66 card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
        >
          {#each regular as item (item.id)}{@render entry(item)}{/each}
          {#if regular.length > 0 && destructive.length > 0}
            <Menu.Separator class="my-1 border-surface-200-800" />
          {/if}
          {#each destructive as item (item.id)}{@render entry(item)}{/each}
        </Menu.Content>
      </Menu.Positioner>
    </Portal>{/if}
</Menu>
