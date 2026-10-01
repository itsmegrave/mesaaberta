<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { page } from '$app/state';
  import InboxList from '$lib/components/InboxList.svelte';

  let { data, children } = $props();

  const currentId = $derived(page.params.id ?? null);

  // The list refreshes now and then and when the tab comes back, only while it can be seen.
  onMount(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void invalidate('messages:inbox');
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  });
</script>

<div class="flex flex-col gap-4 pt-2 pb-4 md:flex-row md:gap-6 md:pt-8">
  <aside
    class="min-w-0 overflow-x-hidden md:block md:max-h-176 md:w-80 md:shrink-0 md:overflow-y-auto {currentId
      ? 'hidden'
      : ''}"
  >
    <InboxList
      items={data.inbox.items}
      page={data.inbox.page}
      pages={data.inbox.pages}
      {currentId}
    />
  </aside>

  <div class="min-w-0 md:flex-1 {currentId ? '' : 'order-first md:order-0'}">
    {@render children()}
  </div>
</div>
