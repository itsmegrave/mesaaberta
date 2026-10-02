<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { onMount } from 'svelte';
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
  <!--
    A plain `role="switch"` button: Skeleton's Switch draws its hidden input with an inline `style`
    attribute, which the CSP blocks (only SvelteKit's announcer style is allowed, by hash).
  -->
  <Button
    size="custom"
    type="button"
    role="switch"
    aria-checked={isDark}
    onclick={() => handlePressedChange(!isDark)}
    class="btn flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
  >
    <span>{m.theme_dark_label()}</span>
    <span
      aria-hidden="true"
      class="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors {isDark
        ? 'bg-primary-500'
        : 'bg-surface-300-700'}"
    >
      <span
        class="size-5 rounded-full bg-white shadow transition-transform {isDark
          ? 'translate-x-5'
          : 'translate-x-0'}"
      ></span>
    </span>
  </Button>
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
    {#if isDark}
      <!-- Sun icon (dark mode -> switch to light) -->
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"
        />
      </svg>
    {:else}
      <!-- Moon icon (light mode -> switch to dark) -->
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
      </svg>
    {/if}
  </Button>
{/if}
