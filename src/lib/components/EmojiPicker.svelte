<script lang="ts">
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import type Picker from 'emoji-picker-element/picker';
  import ptBR from 'emoji-picker-element/i18n/pt_BR';
  import dataSource from 'emoji-picker-element-data/pt/cldr/data.json?url';
  import { m } from '$lib/paraglide/messages';

  let {
    onselect,
    finalFocusEl,
  }: { onselect: (emoji: string) => void; finalFocusEl?: () => HTMLElement | null } = $props();
  let open = $state(false);
  let failed = $state(false);

  function mountPicker(host: HTMLElement) {
    let disposed = false;
    let picker: Picker | undefined;
    failed = false;
    void import('emoji-picker-element/picker')
      .then(({ default: EmojiPicker }) => {
        if (disposed) return;
        picker = new EmojiPicker({ locale: 'pt', i18n: ptBR, dataSource });
        // The package injects a shadow stylesheet; authorize it with SvelteKit's page nonce
        // before attaching the element, without weakening the site's CSP.
        const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
        if (nonce) {
          for (const style of picker.shadowRoot?.querySelectorAll('style') ?? []) {
            style.nonce = nonce;
          }
        }
        picker.addEventListener('emoji-click', (event) => {
          if (!event.detail.unicode) return;
          open = false;
          onselect(event.detail.unicode);
        });
        host.appendChild(picker);
      })
      .catch(() => {
        if (!disposed) failed = true;
      });
    return {
      destroy() {
        disposed = true;
        picker?.remove();
      },
    };
  }
</script>

<Popover
  {finalFocusEl}
  {open}
  onOpenChange={(details) => (open = details.open)}
  positioning={{ placement: 'top-start' }}
>
  <Popover.Trigger
    type="button"
    class="btn size-12 shrink-0 rounded-lg p-0 hover:preset-tonal"
    aria-label={m.messages_emoji_open()}
    ><span aria-hidden="true" class="text-xl">😊</span></Popover.Trigger
  >
  <Popover.Positioner class="z-50">
    <Popover.Content
      class="max-w-full rounded-lg border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
    >
      <Popover.Title class="sr-only">{m.messages_emoji_title()}</Popover.Title>
      {#if open}
        {#if failed}<p role="alert">{m.messages_error_generic()}</p>{/if}
        <div use:mountPicker data-emoji-picker-host class="w-72 max-w-full"></div>
      {/if}
    </Popover.Content>
  </Popover.Positioner>
</Popover>

<style>
  [data-emoji-picker-host] :global(emoji-picker) {
    width: 100%;
    height: calc(var(--spacing) * 80);
    --num-columns: 6;
    --background: light-dark(var(--color-surface-50), var(--color-surface-950));
    --border-color: light-dark(var(--color-surface-200), var(--color-surface-800));
    --border-size: 0px;
    --button-active-background: light-dark(var(--color-surface-200), var(--color-surface-800));
    --button-hover-background: light-dark(var(--color-surface-100), var(--color-surface-900));
    --input-font-color: light-dark(var(--color-surface-950), var(--color-surface-50));
    --input-border-color: light-dark(var(--color-surface-200), var(--color-surface-800));
    --input-padding: calc(var(--spacing) * 2);
    --outline-color: var(--color-primary-500);
    --indicator-color: var(--color-primary-500);
    --category-font-color: light-dark(var(--color-surface-950), var(--color-surface-50));
  }
</style>
