<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- Instagram permalink is an external URL. */
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>{m.instagram_admin_title()} · Mesa Aberta</title></svelte:head>
<section class="grid max-w-2xl gap-4 py-8">
  <h1 class="text-3xl font-semibold">{m.instagram_admin_title()}</h1>
  <p>{m.instagram_admin_description()}</p>
  {#if data.connected}<p role="status">{m.instagram_connected()}</p>{/if}
  {#if data.connectionError}<p role="alert">{m.instagram_connection_error()}</p>{/if}
  {#if !data.configured}<p>{m.instagram_unavailable()}</p>{/if}
  {#if data.account}
    <p>{m.instagram_account({ username: data.account.username })}</p>
    {#if new Date(data.account.expiresAt) <= new Date()}<p>{m.instagram_expired()}</p>{/if}
  {/if}
  {#if form?.publishResult === 'published'}<p role="status">{m.instagram_published()}</p>{/if}
  {#if form?.publishResult === 'already-published'}<p role="status">
      {m.instagram_already_published()}
    </p>{/if}
  {#if form?.publishResult === 'unavailable'}<p role="alert">{m.instagram_unavailable()}</p>{/if}
  {#if form?.publishResult === 'not-eligible'}<p role="alert">{m.instagram_not_eligible()}</p>{/if}
  {#if form?.publishError}<p role="alert">{m.instagram_publish_error()}</p>{/if}
  <h2 class="mt-4 text-2xl font-semibold">{m.instagram_manual_title()}</h2>
  <p>{m.instagram_manual_description()}</p>
  {#if data.tables.length}
    <ul class="grid gap-3">
      {#each data.tables as table (table.id)}
        <li
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200-800 p-4"
        >
          <div>
            <p class="font-semibold">{table.title}</p>
            <p class="text-sm text-muted">
              {table.system} · {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: table.timezone,
              }).format(new Date(table.nextAt!))}
            </p>
            {#if table.instagram?.status === 'published' && table.instagram.permalink}
              <a
                class="text-sm link-underline"
                href={table.instagram.permalink}
                target="_blank"
                rel="noreferrer">{m.instagram_view()}</a
              >
            {:else if table.instagram}
              <p class="text-sm text-muted">{table.instagram.status}</p>
            {/if}
          </div>
          <form method="POST" action="?/publish">
            <input type="hidden" name="tableId" value={table.id} />
            <button
              class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
              disabled={!data.configured ||
                !data.account ||
                new Date(data.account.expiresAt) <= new Date() ||
                (!!table.instagram &&
                  ['published', 'publishing', 'uncertain'].includes(table.instagram.status))}
              >{m.instagram_generate_publish()}</button
            >
          </form>
        </li>
      {/each}
    </ul>
  {:else}
    <p>{m.instagram_no_tables()}</p>
  {/if}
  <form method="POST" action={localizedHref('/admin/instagram/connect', getLocale())}>
    <button
      disabled={!data.configured}
      class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
      >{m.instagram_connect()}</button
    >
  </form>
  {#if form?.invalid}<p role="alert">{m.instagram_reconcile_invalid()}</p>{/if}
  {#if data.uncertain.length}
    <h2 class="mt-4 text-2xl font-semibold">{m.instagram_reconcile_title()}</h2>
    <p>{m.instagram_reconcile_hint()}</p>
    {#each data.uncertain as post (post.tableId)}
      <form
        method="POST"
        action="?/reconcile"
        class="grid gap-2 rounded-lg border border-surface-200-800 p-4"
      >
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
        <button class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
          >{m.instagram_reconcile()}</button
        >
      </form>
    {/each}
  {/if}
</section>
