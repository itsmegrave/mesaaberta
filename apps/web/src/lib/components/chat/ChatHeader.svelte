<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import { muteSchema } from '@mesaaberta/core/messages/schema';
  import { m } from '#lib/paraglide/messages.js';

  import { atHandle } from '@mesaaberta/core/profile/handle';

  let {
    conversation,
    action = '?/mute',
    onback,
    onreport,
    onblock,
  }: {
    action?: string;
    onback?: () => void;
    /** "Denunciar @pessoa…" in a direct conversation (`use_message_safety`); none hides it. */
    onreport?: () => void;
    /** "Bloquear @pessoa…", likewise; hidden once the person is blocked. */
    onblock?: () => void;
    conversation: {
      kind: 'table' | 'direct';
      table: { slug: string; title: string; imageUrl: string | null } | null;
      other: { username: string; avatarUrl: string | null } | null;
      muted: boolean;
      blocked?: boolean;
    };
  } = $props();

  const title = $derived(
    conversation.kind === 'table'
      ? (conversation.table?.title ?? '')
      : atHandle(conversation.other?.username),
  );
  // The ⋮ of a direct conversation: the person's profile, then reporting and blocking them.
  const more = $derived.by((): KebabItem[] => {
    const other = conversation.kind === 'direct' ? conversation.other : null;
    if (!other || !(onreport || onblock)) return [];
    const name = atHandle(other.username);
    return [
      {
        id: 'profile',
        label: m.messages_view_profile(),
        href: `/u/${encodeURIComponent(other.username)}`,
      },
      ...(onreport
        ? [
            {
              id: 'report',
              label: m.messages_report_person({ name }),
              destructive: true,
              onselect: onreport,
            },
          ]
        : []),
      ...(onblock && !conversation.blocked
        ? [
            {
              id: 'block',
              label: m.messages_block_person({ name }),
              destructive: true,
              onselect: onblock,
            },
          ]
        : []),
    ];
  });
  const picture = $derived(
    conversation.kind === 'table' ? conversation.table?.imageUrl : conversation.other?.avatarUrl,
  );
</script>

<header class="flex items-center gap-3 border-b border-surface-200-800 pb-3">
  <!-- "Mensagens › nome": the way back is the first crumb, not an arrow. In the drawer it is a
       button that shows the list again; on a page, the shared trail from "Início". -->
  {#snippet identity()}
    <MAAvatar src={picture} name={title} size={32} />
    <h1 class="min-w-0 truncate text-base font-semibold">{title}</h1>
  {/snippet}
  {#snippet current()}
    {#if conversation.kind === 'table' && conversation.table}
      <a
        href={`/t/${conversation.table.slug}`}
        title={m.messages_open_table()}
        aria-current="page"
        class="flex min-w-0 items-center gap-2 no-underline"
      >
        {@render identity()}
      </a>
    {:else if conversation.other?.username}
      <a
        href={`/u/${encodeURIComponent(conversation.other.username)}`}
        aria-current="page"
        class="flex min-w-0 items-center gap-2 rounded-sm hover:underline focus-visible:outline-4 focus-visible:outline-primary-500"
      >
        {@render identity()}
      </a>
    {:else}
      <span aria-current="page" class="flex min-w-0 items-center gap-2">{@render identity()}</span>
    {/if}
  {/snippet}

  {#if onback}
    <nav aria-label={m.breadcrumbs_label()} class="min-w-0 flex-1">
      <ol class="flex items-center gap-2 text-sm text-muted">
        <li class="flex shrink-0 items-center">
          <MAButton
            size="custom"
            type="button"
            onclick={onback}
            class="btn h-11 rounded-lg px-2 link-underline font-semibold"
            >{m.messages_title()}</MAButton
          >
        </li>
        <li class="flex min-w-0 items-center gap-2 text-surface-950-50">
          <Icon name="chevron-right" size={16} class="text-muted" />
          {@render current()}
        </li>
      </ol>
    </nav>
  {:else}
    <Breadcrumbs
      class="min-w-0 flex-1"
      items={[{ label: m.messages_title(), href: '/m' }, { label: title }]}
    />
  {/if}

  <!-- Posts the opposite of the current state; the page's own action reloads, the drawer's does
       not. -->
  <PostButton
    {action}
    fields={{ muted: !conversation.muted }}
    schema={muteSchema}
    refresh={action === '?/mute'}
    errorMessage={m.messages_error_generic}
    onSuccess={(values) => (conversation.muted = values.muted as boolean)}
    class="m-0"
    buttonClass="btn h-12 rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
  >
    <Icon name={conversation.muted ? 'bell' : 'bell-off'} size={18} />
    <span class="hidden sm:inline"
      >{conversation.muted ? m.messages_unmute() : m.messages_mute()}</span
    >
    <span class="sr-only sm:hidden"
      >{conversation.muted ? m.messages_unmute() : m.messages_mute()}</span
    >
  </PostButton>
  {#if more.length > 0}
    <KebabMenu name={title} items={more} />
  {/if}
</header>
