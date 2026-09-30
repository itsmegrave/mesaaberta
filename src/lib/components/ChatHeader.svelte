<script lang="ts">
  import { defaults, superForm } from 'sveltekit-superforms';
  import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
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
  }: {
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
  const { form, enhance, submitting, delayed, timeout } = superForm(
    defaults({ muted: !conversation.muted }, zod4(muteSchema)),
    { id: 'mute', dataType: 'json', validators: zod4Client(muteSchema), resetForm: false },
  );
  // The switch always asks for the opposite of what the conversation is now.
  $effect(() => {
    const next = !conversation.muted;
    form.update((values) => ({ ...values, muted: next }));
  });
</script>

<header class="flex items-center gap-3 border-b border-surface-200-800 pb-3">
  <a
    href={localizedHref('/messages', locale)}
    class="btn size-12 rounded-lg p-0 hover:preset-tonal md:hidden"
    aria-label={m.messages_back()}
  >
    <Icon name="arrow-left" size={24} />
  </a>

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
  {:else}
    <div class="flex min-w-0 flex-1 items-center gap-3">
      {@render identity()}
    </div>
  {/if}

  <form method="POST" action="?/mute" use:enhance class="m-0">
    <SubmitButton
      submitting={$submitting}
      delayed={$delayed}
      timeout={$timeout}
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
  </form>
</header>
