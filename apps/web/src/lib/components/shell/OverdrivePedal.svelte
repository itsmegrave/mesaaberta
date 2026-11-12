<script lang="ts">
  import { onMount } from 'svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import RailTip from '#lib/components/shell/RailTip.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { claimHint, overdrive, pressPedal } from '#lib/theme/overdrive.svelte.js';

  // The Overdrive switch, drawn as a guitar overdrive pedal beside the light/dark switch: an LED, two
  // knobs and a footswitch. Off it is a grey box; pressed it lights up in Overdrive's yellow and pink
  // and the comic theme paints (Gibi in light, Neon in dark). Only while `use_overdrive_theme` is on.
  // The first pedal a browser shows plays a one-time "Pise aqui!": a stomp, three blinks, a sticker.
  let {
    variant = 'icon',
  }: {
    /**
     * `menu`: the full pedal beside Claro | Escuro in the account menu. `labelled`: a row of the open
     * sidebar. `rail`: the collapsed sidebar's tile. `icon`: the phone header's small pedal.
     */
    variant?: 'menu' | 'labelled' | 'rail' | 'icon';
  } = $props();

  let root = $state<HTMLElement>();
  let hinting = $state(false);
  const label = $derived(overdrive.on ? m.theme_overdrive_turn_off() : m.theme_overdrive_turn_on());

  onMount(() => {
    // Wait a moment so the page has settled, and only play on a pedal that is on screen (the
    // sidebar is hidden on a phone, the header pedal on a desktop).
    const start = setTimeout(() => {
      if (!root || root.getClientRects().length === 0 || !claimHint()) return;
      hinting = true;
      stop = setTimeout(() => (hinting = false), 3200);
    }, 2000);
    let stop: ReturnType<typeof setTimeout> | undefined;
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  });

  const box = $derived(
    overdrive.on
      ? 'border-surface-950 bg-warning-400 text-surface-950 shadow-pedal-on'
      : 'border-surface-600-400 bg-surface-200-800 text-surface-950-50 shadow-pedal',
  );
  const led = $derived(overdrive.on ? 'pedal-led-on' : 'bg-surface-400');
  const stomp = $derived(
    hinting ? 'animate-pedal-stomp motion-reduce:animate-none' : overdrive.on ? '-rotate-3' : '',
  );
</script>

{#snippet bubble(position: string)}
  {#if hinting}
    <span
      aria-hidden="true"
      class="pointer-events-none absolute z-10 animate-pedal-bubble rounded-lg border-3 border-surface-950 bg-warning-400 px-3 py-1 font-comic text-lg tracking-wide whitespace-nowrap text-surface-950 opacity-0 shadow-pedal-on motion-reduce:-rotate-6 motion-reduce:animate-none motion-reduce:opacity-100 {position}"
    >
      {m.theme_overdrive_hint().toUpperCase()}
    </span>
  {/if}
{/snippet}

{#snippet miniPedal()}
  <span
    aria-hidden="true"
    class="flex h-10 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 transition-transform {box} {stomp}"
  >
    <span
      class="size-2 rounded-full border border-surface-950 {led} {hinting
        ? 'animate-pedal-led motion-reduce:animate-none'
        : ''}"
    ></span>
    <span class="size-4 rounded-full border-2 border-current bg-surface-50"></span>
  </span>
{/snippet}

{#if overdrive.allowed}
  {#if variant === 'menu'}
    <span bind:this={root} class="relative flex items-center justify-between gap-3 pt-1 pr-1 pl-3">
      <span class="text-base font-semibold" aria-hidden="true">{m.theme_overdrive()}</span>
      {@render bubble('right-1 bottom-full')}
      <MAButton
        size="custom"
        aria-pressed={overdrive.on}
        aria-label={m.theme_overdrive()}
        title={label}
        onclick={(event) => pressPedal(event.currentTarget)}
        class="flex h-16 w-28 flex-col justify-between rounded-lg border-2 px-2 py-1.5 transition-transform {box} {stomp}"
      >
        <span aria-hidden="true" class="flex items-center gap-1.5">
          <span
            class="size-2.5 rounded-full border border-surface-950 {led} {hinting
              ? 'animate-pedal-led motion-reduce:animate-none'
              : ''}"
          ></span>
          <span class="font-comic text-lg leading-none tracking-wide">
            {m.theme_overdrive().toUpperCase()}
          </span>
        </span>
        <span aria-hidden="true" class="flex items-end justify-between">
          <span class="flex gap-1.5">
            <span
              class="flex size-4 justify-center rounded-full border-2 border-current bg-surface-50 {overdrive.on
                ? 'rotate-135'
                : '-rotate-120'}"><span class="h-1.5 w-0.5 bg-current"></span></span
            >
            <span
              class="flex size-4 justify-center rounded-full border-2 border-current bg-surface-50 {overdrive.on
                ? 'rotate-60'
                : '-rotate-60'}"><span class="h-1.5 w-0.5 bg-current"></span></span
            >
          </span>
          <span class="size-6 rounded-full border-3 border-current bg-surface-50"></span>
        </span>
      </MAButton>
    </span>
  {:else if variant === 'labelled'}
    <span bind:this={root} class="relative block">
      {@render bubble('bottom-full left-0 mb-2')}
      <MAButton
        size="custom"
        aria-pressed={overdrive.on}
        title={label}
        onclick={(event) => pressPedal(event.currentTarget)}
        class="flex h-14 w-full items-center gap-3 rounded-lg px-1 text-left text-sm font-semibold hover:bg-surface-200-800"
      >
        {@render miniPedal()}
        <span class="flex-1">{m.theme_overdrive()}</span>
        <span class="text-xs font-bold text-muted">
          {overdrive.on ? m.theme_overdrive_on() : m.theme_overdrive_off()}
        </span>
      </MAButton>
    </span>
  {:else if variant === 'rail'}
    <span bind:this={root} class="relative inline-flex">
      {@render bubble('bottom-full left-0 mb-1')}
      <RailTip {label}>
        <MAButton
          size="custom"
          aria-label={m.theme_overdrive()}
          aria-pressed={overdrive.on}
          onclick={(event) => pressPedal(event.currentTarget)}
          class="flex size-12 items-center justify-center"
        >
          {@render miniPedal()}
        </MAButton>
      </RailTip>
    </span>
  {:else}
    <span bind:this={root} class="relative inline-flex">
      {@render bubble('top-full right-0 mt-2')}
      <MAButton
        size="custom"
        aria-label={m.theme_overdrive()}
        aria-pressed={overdrive.on}
        title={label}
        onclick={(event) => pressPedal(event.currentTarget)}
        class="flex size-11 items-center justify-center"
      >
        {@render miniPedal()}
      </MAButton>
    </span>
  {/if}
{/if}
