<script lang="ts">
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { m } from '$lib/paraglide/messages';
  let {
    onselect,
    finalFocusEl,
  }: { onselect: (emoji: string) => void; finalFocusEl?: () => HTMLElement | null } = $props();
  let open = $state(false);
  const emojis = [
    '😀',
    '😊',
    '😂',
    '🥰',
    '😎',
    '🤔',
    '😭',
    '😮',
    '👍',
    '👎',
    '❤️',
    '🎉',
    '🔥',
    '✨',
    '🎲',
    '⚔️',
    '🛡️',
    '🐉',
    '🧙',
    '👀',
    '🙌',
    '🤝',
    '💪',
    '🙏',
  ];
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
      class="rounded-lg border border-surface-200-800 bg-surface-50-950 p-3 shadow-xl"
    >
      <Popover.Title class="mb-2 text-sm font-semibold">{m.messages_emoji_title()}</Popover.Title>
      <div class="grid grid-cols-6 gap-1">
        {#each emojis as emoji (emoji)}
          <button
            type="button"
            class="btn size-10 rounded-lg p-0 text-xl hover:preset-tonal"
            aria-label={emoji}
            onclick={() => {
              open = false;
              onselect(emoji);
            }}>{emoji}</button
          >
        {/each}
      </div>
    </Popover.Content>
  </Popover.Positioner>
</Popover>
