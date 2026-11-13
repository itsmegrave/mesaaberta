<script lang="ts">
  import { routes } from '@mesaaberta/core/routes';
  import { z } from 'zod';
  import PostButton from '#lib/components/PostButton.svelte';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data } = $props();

  const month = (value: Date) =>
    value.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });
  const role = (value: 'player' | 'gm' | 'both' | null) =>
    value === 'gm'
      ? m.profile_table_role_gm()
      : value === 'both'
        ? m.profile_table_role_both()
        : value === 'player'
          ? m.profile_table_role_player()
          : null;
  const empty = z.object({});
</script>

<svelte:head><title>{m.match_played_title()} · Mesa Aberta</title></svelte:head>

<section class="py-2 md:pt-12">
  <PageHead
    crumbs={[{ label: m.nav_matches(), href: routes.matches }, { label: m.match_played_title() }]}
    title={m.match_played_title()}
    lede={m.match_played_lede()}
  >
    {#snippet actions()}
      <a href={routes.matchList} class={buttonClass('secondary')}>{m.match_list_link()}</a>
    {/snippet}
  </PageHead>

  {#if data.list.items.length === 0}
    <DirectoryEmpty
      class="mt-8"
      title={m.match_played_empty_title()}
      hint={m.match_played_empty_hint()}
      href={routes.tables}
      action={m.match_played_empty_action()}
    />
  {:else}
    <ul class="mt-8 grid gap-4 md:grid-cols-2">
      {#each data.list.items as person (person.username)}
        {@const line = role(person.tableRole)}
        <li class="flex flex-col gap-4 rounded-lg border border-surface-200-800 bg-panel p-5">
          <div class="flex items-center gap-4">
            <MAAvatar src={person.avatarUrl} name={person.username} size={56} />
            <div class="min-w-0 flex-1">
              <a
                href={routes.profile(person.username)}
                class="block truncate text-lg font-semibold hover:underline">@{person.username}</a
              >
              <p class="truncate text-sm text-muted">
                {line ? `${line} · ` : ''}{m.match_played_tables({ count: person.tables })}
              </p>
            </div>
            <span class="shrink-0 text-xs text-muted">
              {m.match_played_last({ date: month(person.lastAt) })}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <PostButton
              action="{routes.profile(person.username)}?/message"
              schema={empty}
              errorMessage={m.match_message_failed}
              variant="primary"
              size="md"
            >
              <Icon name="send" size={18} />{m.match_played_again()}
            </PostButton>
            <a href={routes.profile(person.username)} class={buttonClass('ghost')}
              >{m.match_played_profile()}</a
            >
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
        href={(page) => (page === 1 ? routes.matchPlayed : `${routes.matchPlayed}?page=${page}`)}
      />
    {/if}
  {/if}
</section>
