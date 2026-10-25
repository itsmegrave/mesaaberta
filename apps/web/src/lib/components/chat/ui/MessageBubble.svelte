<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { linkifyBody } from '#lib/messages/linkify.js';
  import type { ThreadItem } from '#lib/messages/group.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    message,
    onretry,
  }: {
    message: ThreadItem;
    /** Sends a message that failed once more. */
    onretry?: (message: ThreadItem) => void;
  } = $props();

  const parts = $derived(linkifyBody(message.body));
</script>

<div
  class="flex flex-col rounded-2xl px-3 py-2 text-base wrap-break-word {message.own
    ? 'preset-filled-primary-500'
    : 'border border-surface-200-800 bg-surface-100-900'} {message.pending === 'sending'
    ? 'opacity-60'
    : ''}"
>
  {#if message.tableTitle && message.tableSlug}
    <a href={`/t/${message.tableSlug}`} class="mb-1 block text-xs font-semibold underline">
      {m.messages_about_table({ table: message.tableTitle })}
    </a>
  {/if}
  <!-- The body is plain text: only text and http(s) anchors are made from it, never markup. -->
  <p class="whitespace-pre-wrap">
    {#each parts as part, index (index)}
      {#if part.kind === 'link'}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an outside web address, never an app path -->
        <a href={part.href} rel="noopener nofollow ugc" target="_blank" class="break-all underline"
          >{part.text}</a
        >{:else}{part.text}{/if}
    {/each}
  </p>
</div>
{#if message.pending === 'sending'}
  <p class="mt-1 text-xs text-muted">{m.messages_sending()}</p>
{:else if message.pending === 'failed'}
  <p class="mt-1 text-xs font-semibold text-error-700-300">
    {m.messages_failed()} ·
    <MAButton size="custom" type="button" class="underline" onclick={() => onretry?.(message)}>
      {m.messages_retry()}
    </MAButton>
  </p>
{/if}
