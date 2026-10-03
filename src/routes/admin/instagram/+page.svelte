<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import Form from '$lib/components/Form.svelte';
  import Button from '$lib/components/Button.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { toast } from '$lib/toaster';
  import AdminActionForm from '$lib/components/admin/AdminActionForm.svelte';
  import { instagramFeedback } from '$lib/admin/instagram-feedback';
  import Icon from '$lib/components/Icon.svelte';
  import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/contact';
  import { m } from '$lib/paraglide/messages';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let connecting = $state(false);
  let connectionFeedbackShown = $state(false);
  const expired = $derived(Boolean(data.account && new Date(data.account.expiresAt) <= new Date()));
  const status = $derived<Status>(
    !data.account
      ? 'instagram:disconnected'
      : expired
        ? 'instagram:expired'
        : 'instagram:connected',
  );
  $effect(() => {
    if (connectionFeedbackShown) return;
    if (data.connected || data.connectionError) connectionFeedbackShown = true;
    if (data.connected) toast.success(m.instagram_connected());
    if (data.connectionError) toast.error(m.instagram_connection_error());
  });
</script>

<svelte:head><title>{m.admin_connections_title()} · Mesa Aberta</title></svelte:head>
<AdminPage title={m.admin_connections_title()} lede={m.admin_connections_description()}>
  <section
    aria-labelledby="instagram"
    class="mt-8 grid max-w-3xl gap-4 rounded-lg border border-surface-200-800 bg-panel p-5"
  >
    <div class="flex flex-wrap items-center gap-3">
      <Icon name="instagram" size={28} />
      <h2 id="instagram" class="text-lg font-semibold">{m.instagram_admin_title()}</h2>
      <StatusBadge {status} />
    </div>
    <p>{m.instagram_admin_description()}</p>
    <p>
      {m.instagram_profile_label()}:
      <!-- eslint-disable svelte/no-navigation-without-resolve -- Instagram is an external website, not an app route -->
      <a href={INSTAGRAM_URL} rel="noopener" target="_blank" class="link-underline font-semibold"
        >@{INSTAGRAM_HANDLE}</a
      >
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </p>
    {#if !data.configured}<p>{m.instagram_unavailable()}</p>{/if}
    {#if data.account}
      <p>{m.instagram_account({ username: data.account.username })}</p>
      {#if expired}<p>{m.instagram_expired()}</p>{/if}
    {/if}
    <div class="flex flex-wrap items-center gap-3">
      {#if !data.account || expired}
        <Form
          onsubmit={(event) => {
            if (connecting) event.preventDefault();
            else connecting = true;
          }}
          method="POST"
          action={localizedHref('/admin/instagram/connect', getLocale())}
        >
          <Button
            size="custom"
            disabled={!data.configured || connecting}
            aria-busy={connecting}
            class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
            >{m.instagram_connect()}</Button
          >
        </Form>
      {/if}
      <!-- eslint-disable svelte/no-navigation-without-resolve -- Instagram is an external website, not an app route -->
      <a
        href={INSTAGRAM_URL}
        rel="noopener"
        target="_blank"
        class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
        >{m.instagram_view_profile()}</a
      >
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </div>
    {#if data.uncertain.length}
      <h3 class="mt-2 text-lg font-semibold">{m.instagram_reconcile_title()}</h3>
      <p>{m.instagram_reconcile_hint()}</p>
      {#each data.uncertain as post (post.tableId)}
        <div class="grid gap-2 rounded-lg border border-surface-200-800 p-4">
          <AdminActionForm action="?/reconcile" onresult={instagramFeedback}>
            {#snippet children(pending)}
              <p class="break-all">{post.tableId} · {post.containerId}</p>
              <input type="hidden" name="tableId" value={post.tableId} />
              <label class="grid gap-2"
                >{m.instagram_permalink()}<TextInput
                  class="input"
                  type="url"
                  name="permalink"
                  required
                  placeholder="https://www.instagram.com/p/.../"
                /></label
              >
              <Button
                size="custom"
                disabled={pending}
                aria-busy={pending}
                class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
                >{m.instagram_reconcile()}</Button
              >
            {/snippet}</AdminActionForm
          >
        </div>
      {/each}
    {/if}
  </section>
</AdminPage>
