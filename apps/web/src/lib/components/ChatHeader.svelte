<script lang="ts">
  import { untrack } from 'svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Button from '$lib/components/Button.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from './Form.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { muteSchema } from '$lib/messages/schema';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { atHandle } from '$lib/profile/handle';

  let {
    conversation,
    action = '?/mute',
    onback,
  }: {
    action?: string;
    onback?: () => void;
    conversation: {
      kind: 'table' | 'direct';
      table: { slug: string; title: string; imageUrl: string | null } | null;
      other: { username: string; avatarUrl: string | null } | null;
      muted: boolean;
    };
  } = $props();

  const locale = getLocale();
  const title = $derived(
    conversation.kind === 'table'
      ? (conversation.table?.title ?? '')
      : atHandle(conversation.other?.username),
  );
  const picture = $derived(
    conversation.kind === 'table' ? conversation.table?.imageUrl : conversation.other?.avatarUrl,
  );

  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    initial: { muted: !conversation.muted },
    schema: muteSchema,
    refresh: action === '?/mute',
    errorMessage: m.messages_error_generic,
    onSuccess() {
      conversation.muted = controller.values.muted;
    },
  });
  // Only a change of `muted` should run this: `change` also reads and rewrites the form's errors,
  // which would make the effect depend on (and retrigger) itself.
  $effect(() => {
    const next = !conversation.muted;
    untrack(() => controller.change('muted', next));
  });
</script>

<header class="flex items-center gap-3 border-b border-surface-200-800 pb-3">
  <!-- "Mensagens › nome": the way back is the first crumb, not an arrow. In the drawer it is a
       button that shows the list again; on a page, the shared trail from "Início". -->
  {#snippet identity()}
    <Avatar src={picture} name={title} size={32} />
    <h1 class="min-w-0 truncate text-base font-semibold">{title}</h1>
  {/snippet}
  {#snippet current()}
    {#if conversation.kind === 'table' && conversation.table}
      <a
        href={localizedHref(`/tables/${conversation.table.slug}`, locale)}
        title={m.messages_open_table()}
        aria-current="page"
        class="flex min-w-0 items-center gap-2 no-underline"
      >
        {@render identity()}
      </a>
    {:else if conversation.other?.username}
      <a
        href={localizedHref(`/u/${encodeURIComponent(conversation.other.username)}`, locale)}
        aria-current="page"
        class="flex min-w-0 items-center gap-2 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-primary-500"
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
          <Button
            size="custom"
            type="button"
            onclick={onback}
            class="btn h-11 rounded-lg px-2 link-underline font-semibold"
            >{m.messages_title()}</Button
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
      items={[{ label: m.messages_title(), href: '/messages' }, { label: title }]}
    />
  {/if}

  <Form {action} onsubmit={controller.submit} class="m-0">
    <input type="hidden" name="muted" value={String(controller.values.muted)} />
    <SubmitButton
      submitting={controller.pending}
      delayed={controller.delayed}
      timeout={controller.timeout}
      class="btn h-12 rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
    >
      <Icon name={conversation.muted ? 'bell' : 'bell-off'} size={18} />
      <span class="hidden sm:inline"
        >{conversation.muted ? m.messages_unmute() : m.messages_mute()}</span
      >
      <span class="sr-only sm:hidden"
        >{conversation.muted ? m.messages_unmute() : m.messages_mute()}</span
      >
    </SubmitButton>
  </Form>
</header>
