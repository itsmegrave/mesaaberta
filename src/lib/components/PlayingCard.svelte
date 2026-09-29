<script lang="ts">
  import { atHandle } from '$lib/profile/handle';
  import { formatSession } from '$lib/tables/format';
  import { shownTimezone } from '$lib/time/shown-timezone';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import ActionForm from './ActionForm.svelte';

  type Item = {
    slug: string;
    title: string;
    systemName: string;
    gmName: string;
    status: 'pending' | 'confirmed';
    tableStatus: 'active' | 'disabled';
    timezone: string;
    nextAt: Date | null;
    canRate: boolean;
    rating: { gmScore: number } | null;
  };

  let { item, next }: { item: Item; next: string } = $props();

  const locale = getLocale();
  const page = $derived(localizedHref(`/tables/${item.slug}`, locale));
</script>

<article class="rounded-lg border border-surface-200-800 bg-panel p-6">
  <p class="flex flex-wrap items-center gap-2 text-sm">
    {#if item.status === 'pending'}
      <span
        class="chip h-6 rounded-full bg-warning-status px-3 text-xs font-semibold text-surface-50-950"
        >{m.dash_waiting()}</span
      >
    {:else}
      <span class="chip h-6 rounded-full preset-filled-primary-500 px-3 text-xs font-semibold">
        {m.dash_you_have_seat()}
      </span>
    {/if}
    {#if item.tableStatus === 'disabled'}<span class="font-semibold">{m.dash_disabled()}</span>{/if}
    <span class="font-semibold text-muted">{item.systemName}</span>
  </p>

  <h3 class="mt-3 text-2xl leading-tight font-semibold tracking-tight">
    <a href={page} class="hover:underline">{item.title}</a>
  </h3>
  <p class="mt-1 text-sm text-muted">{m.table_gm()}: {atHandle(item.gmName)}</p>

  {#if item.nextAt}
    <p class="mt-4 flex items-start gap-2">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="mt-1 shrink-0"
        ><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path
          d="M3.5 10h17M8 3v4M16 3v4"
        /></svg
      >
      <span
        ><span class="font-semibold">{m.table_next_session()}:</span>
        {formatSession(item.nextAt, shownTimezone(item.timezone), locale)}</span
      >
    </p>
  {/if}

  {#if item.canRate}
    <p class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-lamp-wash px-4 py-3">
      {#if item.rating}
        {m.dash_your_rating({ gm: item.rating.gmScore })}
        <a href="{page}#avaliar" class="anchor">{m.dash_change_rating()}</a>
      {:else}
        {m.dash_rate_prompt()}
        <a
          href="{page}#avaliar"
          class="btn h-10 rounded-lg preset-filled-primary-500 px-4 font-semibold sm:ml-auto"
          >{m.dash_rate_action()}</a
        >
      {/if}
    </p>
  {/if}

  <!-- Leaving, or withdrawing a request, posts to the table's own action and comes back here. -->
  <ActionForm
    action="{page}?/leave"
    {next}
    class="mt-5"
    label={item.status === 'pending' ? m.table_cancel_request() : m.table_leave()}
    buttonClass="btn h-11 rounded-lg border-2 border-primary-500 px-4 font-semibold"
    success={item.status === 'pending' ? m.toast_request_withdrawn() : m.toast_left()}
  />
</article>
