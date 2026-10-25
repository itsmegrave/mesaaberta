<script lang="ts">
  // The parts of "Editar perfil" as a column beside the content, like the admin's. Phones have no
  // column: one full-width "Seção: …" button opens the same list as a menu.
  import { goto } from '$app/navigation';
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { profileSections } from '#lib/profile/sections.js';
  import { m } from '#lib/paraglide/messages.js';

  let { path }: { /** The page's path, to mark its section. */ path: string } = $props();

  const sections = profileSections();
  const current = $derived(
    sections.find((section) => section.path === path.replace(/\/$/, '')) ?? sections[0],
  );

  // Built when it opens: a closed menu would put an inline `style` on the page, which the CSP refuses.
  let open = $state(false);
  // Until JavaScript runs a phone gets the sections as plain links, since the menu needs it.
  let mounted = $state(false);
  onMount(() => (mounted = true));
</script>

<!-- 236px wide (59 × 4px) and sticky at the top of the content. -->
<nav
  aria-label={m.profile_sections_label()}
  class="sticky top-6 hidden w-59 shrink-0 self-start md:block"
>
  <ul class="grid gap-1">
    {#each sections as section (section.path)}
      {@const here = current.path === section.path}
      <li class="relative">
        <a
          href={section.path}
          aria-current={here ? 'page' : undefined}
          class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold no-underline hover:bg-surface-wash aria-[current=page]:bg-surface-wash"
        >
          <Icon name={section.icon} size={20} class="shrink-0 {here ? '' : 'text-muted'}" />
          <span class="min-w-0 flex-1 truncate">{section.label}</span>
        </a>
        {#if here}
          <!-- The bar of the current section, on the left edge of its item. -->
          <span
            aria-hidden="true"
            class="absolute inset-y-2 left-0 w-0.75 rounded-full bg-primary-500"
          ></span>
        {/if}
      </li>
    {/each}
  </ul>
</nav>

{#if !mounted}
  <nav aria-label={m.profile_sections_label()} class="md:hidden">
    <ul class="flex flex-wrap gap-2">
      {#each sections as section (section.path)}
        <li>
          <a
            href={section.path}
            aria-current={current.path === section.path ? 'page' : undefined}
            class="flex min-h-11 items-center rounded-lg border border-surface-200-800 px-3 text-sm font-semibold no-underline aria-[current=page]:bg-surface-wash"
            >{section.label}</a
          >
        </li>
      {/each}
    </ul>
  </nav>
{/if}
<div class="md:hidden {mounted ? '' : 'hidden'}">
  <Menu
    {open}
    onOpenChange={(details) => (open = details.open)}
    positioning={{ placement: 'bottom-start', sameWidth: true, offset: { mainAxis: 4 } }}
    onSelect={({ value }) => void goto(value)}
  >
    <Menu.Trigger
      class="btn flex h-12 w-full items-center justify-between gap-2 rounded-lg border-2 border-surface-200-800 bg-panel px-4 font-semibold"
    >
      <span class="min-w-0 flex-1 truncate text-left"
        >{m.profile_section({ name: current.label })}</span
      >
      <Icon name="chevron-down" size={18} />
    </Menu.Trigger>
    {#if open}<Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content
            aria-label={m.profile_sections_label()}
            class="card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
          >
            {#each sections as section (section.path)}
              <Menu.Item
                value={section.path}
                aria-current={current.path === section.path ? 'page' : undefined}
                class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold aria-[current=page]:bg-surface-wash data-highlighted:preset-tonal"
              >
                <Icon name={section.icon} size={20} class="shrink-0 text-muted" />
                <span class="min-w-0 flex-1 truncate">{section.label}</span>
                {#if current.path === section.path}<Icon name="check" size={18} />{/if}
              </Menu.Item>
            {/each}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>{/if}
  </Menu>
</div>
