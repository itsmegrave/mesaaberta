<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { m } from '$lib/paraglide/messages';
  import { applyChoice, readChoice, type ThemeChoice } from '$lib/theme/theme';

  let isDark = $state(false);
  let activeChoice = $state<ThemeChoice>('system');

  onMount(() => {
    const stored = readChoice();
    activeChoice = stored;
    if (stored === 'dark') {
      isDark = true;
    } else if (stored === 'light') {
      isDark = false;
    } else {
      // Follows the system until the first click
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (activeChoice === 'system') {
        isDark = e.matches;
        applyChoice('system');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  });

  function handlePressedChange(pressed: boolean) {
    isDark = pressed;
    activeChoice = pressed ? 'dark' : 'light';
    applyChoice(activeChoice);
  }

  /** `icon`: a round icon button. `switch`: a labelled switch ("Tema escuro"), for the open side nav. */
  let { variant = 'icon' }: { variant?: 'icon' | 'switch' } = $props();
</script>

{#if variant === 'switch'}
  <Switch
    checked={isDark}
    onCheckedChange={(details) => handlePressedChange(details.checked)}
    class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
  >
    <Switch.Label>{m.theme_dark_label()}</Switch.Label>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.HiddenInput role="switch" />
  </Switch>
{:else}
  <Button
    size="custom"
    type="button"
    aria-label="Tema escuro"
    aria-pressed={isDark}
    title={isDark ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
    onclick={() => handlePressedChange(!isDark)}
    class="btn-icon size-11 shrink-0 rounded-full border border-surface-200-800 hover:preset-tonal"
  >
    <!-- The sun when dark (switches to light), the moon when light (switches to dark). -->
    <Icon name={isDark ? 'sun' : 'moon'} size={20} />
  </Button>
{/if}
