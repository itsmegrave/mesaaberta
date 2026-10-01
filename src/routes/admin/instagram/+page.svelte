<script lang="ts">
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { toast } from '$lib/toaster';
  import AdminActionForm from '$lib/components/admin/AdminActionForm.svelte';
  import { instagramFeedback } from '$lib/admin/instagram-feedback';
  import { m } from '$lib/paraglide/messages';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let connecting = $state(false);
  let connectionFeedbackShown = $state(false);
  $effect(() => {
    if (connectionFeedbackShown) return;
    if (data.connected || data.connectionError) connectionFeedbackShown = true;
    if (data.connected) toast.success(m.instagram_connected());
    if (data.connectionError) toast.error(m.instagram_connection_error());
  });
</script>

<svelte:head><title>{m.instagram_admin_title()} · Mesa Aberta</title></svelte:head>
<section class="grid max-w-2xl gap-4 py-8">
  <h1 class="text-3xl font-semibold">{m.instagram_admin_title()}</h1>
  <p>{m.instagram_admin_description()}</p>
  {#if !data.configured}<p>{m.instagram_unavailable()}</p>{/if}
  {#if data.account}
    <p>{m.instagram_account({ username: data.account.username })}</p>
    {#if new Date(data.account.expiresAt) <= new Date()}<p>{m.instagram_expired()}</p>{/if}
  {/if}
  {#if !data.account || new Date(data.account.expiresAt) <= new Date()}
    <form
      onsubmit={(event) => {
        if (connecting) event.preventDefault();
        else connecting = true;
      }}
      method="POST"
      action={localizedHref('/admin/instagram/connect', getLocale())}
    >
      <button
        disabled={!data.configured || connecting}
        aria-busy={connecting}
        class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
        >{m.instagram_connect()}</button
      >
    </form>
  {/if}
  {#if data.uncertain.length}
    <h2 class="mt-4 text-2xl font-semibold">{m.instagram_reconcile_title()}</h2>
    <p>{m.instagram_reconcile_hint()}</p>
    {#each data.uncertain as post (post.tableId)}
      <div class="grid gap-2 rounded-lg border border-surface-200-800 p-4">
        <AdminActionForm action="?/reconcile" onresult={instagramFeedback}>
          {#snippet children(pending)}
            <p class="break-all">{post.tableId} · {post.containerId}</p>
            <input type="hidden" name="tableId" value={post.tableId} />
            <label class="grid gap-2"
              >{m.instagram_permalink()}<input
                class="input"
                type="url"
                name="permalink"
                required
                placeholder="https://www.instagram.com/p/.../"
              /></label
            >
            <button
              disabled={pending}
              aria-busy={pending}
              class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
              >{m.instagram_reconcile()}</button
            >
          {/snippet}</AdminActionForm
        >
      </div>
    {/each}
  {/if}
</section>
