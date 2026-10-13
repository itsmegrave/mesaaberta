<script lang="ts">
  import ChatThread from '$lib/components/ChatThread.svelte';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
</script>

<svelte:head>
  <title>{m.messages_title()} · Mesa Aberta</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#key data.conversation.id}
  <ChatThread {data} />
{/key}
