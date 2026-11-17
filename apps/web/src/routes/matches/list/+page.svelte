<script lang="ts">
  import { routes } from '@mesaaberta/core/routes';
  import type { MatchListItem } from '@mesaaberta/core/server/matches/service';
  import { z } from 'zod';
  import PostButton from '#lib/components/PostButton.svelte';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { cardLine } from '../components/person';

  let { data } = $props();

  // Desfazer asks first: it cannot be taken back.
  let ending = $state<MatchListItem | null>(null);
  let confirming = $state(false);
  const ask = (item: MatchListItem) => {
    ending = item;
    confirming = true;
  };
  const date = (value: Date) =>
    value.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    });
  const empty = z.object({});
  const byId = z.object({ id: z.uuid() });
</script>

<svelte:head><title>{m.match_list_title()} · Mesa Aberta</title></svelte:head>

<section class="py-2 md:pt-12">
  <PageHead
    crumbs={[{ label: m.nav_matches(), href: routes.matches }, { label: m.match_list_title() }]}
    title={m.match_list_title()}
    lede={m.match_list_lede()}
  >
    {#snippet actions()}
      <div class="flex flex-wrap gap-2">
        <a href={routes.matches} class={buttonClass('primary')}>{m.match_list_back()}</a>
        {#if data.graph}
          <a href={routes.matchPlayed} class={buttonClass('secondary')}>{m.match_played_link()}</a>
        {/if}
      </div>
    {/snippet}
  </PageHead>

  {#if data.list.items.length === 0}
    <DirectoryEmpty
      class="mt-8"
      title={m.match_list_empty_title()}
      hint={m.match_list_empty_hint()}
      href={routes.matches}
      action={m.match_list_back()}
    />
  {:else}
    <ul class="mt-8 grid gap-4 md:grid-cols-2">
      {#each data.list.items as item (item.id)}
        {@const person = item.person}
        <li class="flex flex-col gap-4 rounded-lg border border-surface-200-800 bg-panel p-5">
          <div class="flex items-center gap-4">
            <MAAvatar src={person.avatarUrl} name={person.username} size={56} />
            <div class="min-w-0 flex-1">
              <a
                href={routes.profile(person.username)}
                class="block truncate text-lg font-semibold hover:underline">@{person.username}</a
              >
              <p class="truncate text-sm text-muted">{cardLine(person)}</p>
            </div>
            <span class="shrink-0 text-xs text-muted">
              {m.match_list_since({ date: date(item.createdAt) })}
            </span>
          </div>
          {#if person.commonSystems.length > 0 || person.commonSlots > 0}
            <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {#if person.commonSystems.length > 0}
                <span class="inline-flex items-center gap-1.5">
                  <Icon name="check" size={16} />{person.commonSystems
                    .map((s) => s.name)
                    .join(', ')}
                </span>
              {/if}
              {#if person.commonSlots > 0}
                <span class="inline-flex items-center gap-1.5">
                  <Icon name="clock" size={16} />{m.match_common_slots({
                    count: person.commonSlots,
                  })}
                </span>
              {/if}
            </p>
          {/if}
          <div class="flex flex-wrap items-center gap-3">
            <PostButton
              action="{routes.profile(person.username)}?/message"
              schema={empty}
              errorMessage={m.match_message_failed}
              variant="primary"
              size="md"
            >
              <Icon name="send" size={18} />{m.match_it_message()}
            </PostButton>
            <button type="button" class={buttonClass('ghost')} onclick={() => ask(item)}>
              {m.match_list_end()}
            </button>
          </div>
        </li>
      {/each}
    </ul>
    {#if data.list.pages > 1}
      <Pager
        class="mt-8"
        compact
        page={data.page}
        pages={data.list.pages}
        href={(page) => (page === 1 ? routes.matchList : `${routes.matchList}?page=${page}`)}
      />
    {/if}
  {/if}
</section>

<DialogShell
  bind:open={confirming}
  role="alertdialog"
  sheet
  title={m.match_end_title({ user: `@${ending?.person.username ?? ''}` })}
  description={m.match_end_text()}
>
  <DialogActions class="mt-6" cancel={m.confirm_cancel()}>
    {#snippet confirmButton()}
      {#if ending}
        <PostButton
          action="?/end"
          fields={{ id: ending.id }}
          schema={byId}
          errorMessage={m.match_answer_failed}
          success={m.match_end_done()}
          onSuccess={() => (confirming = false)}
          variant="danger"
          size="md"
        >
          {m.match_list_end()}
        </PostButton>
      {/if}
    {/snippet}
  </DialogActions>
</DialogShell>
