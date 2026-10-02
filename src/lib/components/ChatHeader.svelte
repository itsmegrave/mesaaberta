<script lang="ts">
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
  $effect(() => {
    controller.change('muted', !conversation.muted);
  });
</script>

<header class="flex items-center gap-3 border-b border-surface-200-800 pb-3">
  {#if onback}
    <Button
      size="custom"
      type="button"
      onclick={onback}
      class="btn size-12 shrink-0 p-0 hover:preset-tonal"
      aria-label={m.messages_back()}><Icon name="arrow-left" size={24} /></Button
    >
  {:else}
    <a
      href={localizedHref('/messages', locale)}
      class="btn size-12 rounded-lg p-0 hover:preset-tonal md:hidden"
      aria-label={m.messages_back()}
    >
      <Icon name="arrow-left" size={24} />
    </a>
  {/if}

  {#snippet identity()}
    <Avatar src={picture} name={title} size={40} />
    <h1 class="min-w-0 truncate text-lg font-semibold">{title}</h1>
  {/snippet}

  {#if conversation.kind === 'table' && conversation.table}
    <a
      href={localizedHref(`/tables/${conversation.table.slug}`, locale)}
      title={m.messages_open_table()}
      class="flex min-w-0 flex-1 items-center gap-3 no-underline"
    >
      {@render identity()}
    </a>
  {:else if conversation.other?.username}
    <a
      href={localizedHref(`/u/${encodeURIComponent(conversation.other.username)}`, locale)}
      class="flex min-w-0 flex-1 items-center gap-3 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-primary-500"
    >
      {@render identity()}
    </a>
  {:else}
    <div class="flex min-w-0 flex-1 items-center gap-3">
      {@render identity()}
    </div>
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
