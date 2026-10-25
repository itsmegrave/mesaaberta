<script lang="ts">
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import NextSession from '#lib/components/ui/NextSession.svelte';

  type Item = {
    slug: string;
    title: string;
    systemName: string;
    gmName: string;
    status: 'pending' | 'confirmed';
    timezone: string;
    startsAt: Date;
    canRate: boolean;
    rating: { gmScore: number } | null;
  };

  let { item, next }: { item: Item; next: string } = $props();

  const page = $derived(`/t/${item.slug}`);
</script>

<article class="rounded-lg border border-surface-200-800 bg-panel p-6">
  <p class="flex flex-wrap items-center gap-2 text-sm">
    {#if item.status === 'pending'}
      <Pill tone="warning">{m.dash_waiting()}</Pill>
    {:else}
      <Pill>{m.dash_you_have_seat()}</Pill>
    {/if}
    <span class="font-semibold text-muted">{item.systemName}</span>
  </p>

  <h3 class="mt-3 text-2xl leading-tight font-semibold tracking-tight">
    <a href={page} class="hover:underline">{item.title}</a>
  </h3>
  <p class="mt-1 text-sm text-muted">{m.table_gm()}: <UserLink username={item.gmName} /></p>

  <NextSession startsAt={item.startsAt} timezone={item.timezone} />

  {#if item.canRate}
    <p class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-lamp-wash px-4 py-3">
      {#if item.rating}
        {m.dash_your_rating({ gm: item.rating.gmScore })}
        <a href="{page}#avaliar" class="anchor">{m.dash_change_rating()}</a>
      {:else}
        {m.dash_rate_prompt()}
        <a
          href="{page}#avaliar"
          class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold sm:ml-auto"
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
    buttonClass="btn h-12 rounded-lg border-2 border-primary-500 px-4 font-semibold"
    success={item.status === 'pending' ? m.toast_request_withdrawn() : m.toast_left()}
  />
</article>
