<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { onMount } from 'svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { applyChoice, readChoice, type ThemeChoice } from '#lib/theme/theme.js';

  let {
    labelled = false,
    rail = false,
    segmented = false,
    labelledby,
  }: {
    /** A "Tema escuro" row with a switch, for the open side nav. */
    labelled?: boolean;
    /** The collapsed side nav's item: the icon on a 40px tile over "Tema". */
    rail?: boolean;
    /** Claro | Escuro as two segments, for the account menu. */
    segmented?: boolean;
    /** The id of the text that names the segmented control. */
    labelledby?: string;
  } = $props();

  let isDark = $state(false);
  // The icon only turns when the theme changes while the page is open, never on the first paint.
  let animate = $state(false);
  const glyphs = $derived([
    { name: 'moon', shown: !isDark, hidden: '-rotate-90' },
    { name: 'sun', shown: isDark, hidden: 'rotate-90' },
  ] as const);
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
        animate = true;
        isDark = e.matches;
        applyChoice('system');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  });

  function handlePressedChange(pressed: boolean) {
    animate = true;
    isDark = pressed;
    activeChoice = pressed ? 'dark' : 'light';
    applyChoice(activeChoice);
  }
</script>

<!-- The moon in the light theme, the sun in the dark one: the same icon open, in the rail and in the
     header. On a change one turns and fades into the other; reduced motion swaps them in place. -->
{#snippet themeIcon()}
  <span aria-hidden="true" class="grid size-5 shrink-0 place-items-center">
    {#each glyphs as glyph (glyph.name)}
      <span
        data-shown={glyph.shown}
        class="col-start-1 row-start-1 flex {animate
          ? 'transition duration-300 ease-out motion-reduce:transition-none'
          : ''} {glyph.shown
          ? 'scale-100 rotate-0 opacity-100'
          : `scale-50 opacity-0 ${glyph.hidden}`}"
      >
        <Icon name={glyph.name} size={20} />
      </span>
    {/each}
  </span>
{/snippet}

{#snippet segment(dark: boolean, icon: 'sun' | 'moon', label: string)}
  {@const checked = isDark === dark}
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    tabindex={checked ? 0 : -1}
    onclick={() => handlePressedChange(dark)}
    onkeydown={(event) => {
      // Arrow keys move between the two segments, as in a native radio group.
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        handlePressedChange(!dark);
        const group = (event.currentTarget as HTMLElement).parentElement;
        group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
      }
    }}
    class="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold {checked
      ? 'preset-filled-primary-500'
      : 'text-surface-950-50 hover:bg-surface-200-800'}"
  >
    <Icon name={icon} size={16} />
    {label}
  </button>
{/snippet}

{#if segmented}
  <!-- Choosing keeps the account menu open, so the change is seen where it was made. -->
  <div
    role="radiogroup"
    aria-labelledby={labelledby}
    aria-label={labelledby ? undefined : m.theme_label()}
    class="flex gap-1 rounded-full bg-surface-200-800 p-1"
  >
    {@render segment(false, 'sun', m.theme_light())}
    {@render segment(true, 'moon', m.theme_dark())}
  </div>
{:else if labelled}
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
    <span class="flex shrink-0 text-muted">{@render themeIcon()}</span>
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
{:else if rail}
  <button
    type="button"
    aria-label={m.theme_dark_mode()}
    aria-pressed={isDark}
    title={isDark ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
    onclick={() => handlePressedChange(!isDark)}
    class="group relative flex min-h-14 w-16 flex-col items-center justify-center gap-1 py-1 text-center text-xs leading-tight font-semibold text-muted hover:text-surface-950-50"
  >
    <span
      class="flex size-10 shrink-0 items-center justify-center rounded-lg group-hover:bg-surface-200-800"
    >
      {@render themeIcon()}
    </span>
    <span aria-hidden="true" class="w-full min-w-0">{m.nav_theme_rail()}</span>
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
    {@render themeIcon()}
  </MAButton>
{/if}
