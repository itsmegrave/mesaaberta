<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { onMount } from 'svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { applyChoice, readChoice, type ThemeChoice } from '#lib/theme/theme.js';

  let {
    labelled = false,
  }: {
    /** A "Tema escuro" row with a switch, for the open side nav. */
    labelled?: boolean;
  } = $props();

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

{#if labelled}
  <!-- A plain switch button: Skeleton's Switch draws its hidden input with an inline style, which the
       CSP blocks in server-rendered HTML. -->
  <button
    type="button"
    role="switch"
    aria-checked={isDark}
    title={isDark ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
    onclick={() => handlePressedChange(!isDark)}
    class="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold hover:bg-surface-200-800"
  >
    <span class="flex shrink-0 text-muted"><Icon name="moon" size={20} /></span>
    <span class="flex-1">{m.theme_dark_mode()}</span>
    <span
      aria-hidden="true"
      class="relative inline-block h-6 w-10 shrink-0 rounded-full border {isDark
        ? 'border-primary-500 bg-primary-500'
        : 'border-surface-600-400 bg-surface-200-800'}"
    >
      <span
        class="absolute top-0.5 size-4.5 rounded-full transition-[left] {isDark
          ? 'left-4.5 bg-primary-contrast-500'
          : 'left-0.5 bg-surface-600-400'}"
      ></span>
    </span>
  </button>
{:else}
  <MAButton
    size="custom"
    type="button"
    aria-label={m.theme_dark_mode()}
    aria-pressed={isDark}
    title={isDark ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
    onclick={() => handlePressedChange(!isDark)}
    class="btn-icon size-11 shrink-0 rounded-full border border-surface-200-800 hover:preset-tonal"
  >
    <!-- The sun when dark (switches to light), the moon when light (switches to dark). -->
    <Icon name={isDark ? 'sun' : 'moon'} size={20} />
  </MAButton>
{/if}
