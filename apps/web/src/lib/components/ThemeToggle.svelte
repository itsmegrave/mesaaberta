<script lang="ts">
  import Button from '#lib/components/Button.svelte';
  import { onMount } from 'svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { applyChoice, readChoice, type ThemeChoice } from '#lib/theme/theme.js';

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
</script>

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
