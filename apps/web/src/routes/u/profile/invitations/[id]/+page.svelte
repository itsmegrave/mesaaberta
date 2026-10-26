<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import InvitationAction from '#lib/components/InvitationAction.svelte';
  import { kindLabel } from '#lib/tables/format.js';
  import { formatSession } from '@mesaaberta/core/tables/format';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  // The invite: the table's title, who invited and when it plays, then the answer. While it waits,
  // a notice says until when the seat is held; once answered (or lapsed) a StatusBadge says how it
  // ended. Blocking the person who invited asks first.
  let { data, form } = $props();
  const invitation = $derived(data.invitation);
  const table = $derived(invitation.table);
  const locale = getLocale();
  const gm = $derived(invitation.gmUsername || '');
  // A pending invite past its deadline has lapsed, even before the sweep marks it.
  const status = $derived(
    invitation.status === 'pending' && new Date(invitation.expiresAt) <= new Date()
      ? 'expired'
      : invitation.status,
  );
  const when = (date: Date | string) => formatSession(new Date(date), table.timezone, locale);
  let blockOpen = $state(false);
  const cancel = () => document.querySelector<HTMLElement>('[data-block-cancel]');
</script>

<svelte:head
  ><title>{table.title} · {m.invitation_title()} · Mesa Aberta</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<section class="mx-auto max-w-2xl py-8 md:py-12">
  <Breadcrumbs
    items={[{ label: m.nav_my_tables(), href: '/u/tables' }, { label: m.invitation_crumb() }]}
  />
  <div class="mt-6 rounded-lg border border-surface-200-800 bg-panel p-6">
    <p class="text-sm font-semibold text-muted">{m.invitation_title()}</p>
    <h1 class="mt-1 text-3xl leading-tight font-semibold tracking-tight wrap-break-word">
      {table.title}
    </h1>
    <p class="mt-2">
      {m.invitation_from_table({ gm, kind: kindLabel(table.kind), date: when(table.startsAt) })}
    </p>

    {#if form && ('error' in form || ('form' in form && !form.form.valid))}
      <p role="alert" class="mt-4 text-error-alert">{m.invitation_unavailable()}</p>
    {/if}

    {#if status === 'pending'}
      <div
        role="status"
        class="mt-4 flex items-start gap-3 rounded-lg border border-warning-500 bg-lamp-wash px-4 py-3"
      >
        <Icon name="clock" size={20} class="mt-0.5 shrink-0 text-lamp" />
        <div class="min-w-0">
          <p class="font-semibold">{m.invitation_status_pending()}</p>
          <p class="mt-1 text-sm">
            {m.invitation_reserved_until({ date: when(invitation.expiresAt) })}
          </p>
        </div>
      </div>
      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <InvitationAction action="?/accept" variant="primary" label={m.invitation_accept()} />
        <InvitationAction action="?/decline" label={m.invitation_decline()} />
      </div>
    {:else}
      <div class="mt-4 flex flex-col items-start gap-3">
        <StatusBadge status="invitation:{status}" />
        {#if status === 'accepted'}
          <p>{m.invitation_accepted_text()}</p>
          <a href="/t/{table.slug}" class="{buttonClass('secondary', 'md')} font-semibold"
            >{m.manage_view_page()}</a
          >
        {/if}
      </div>
    {/if}

    <div class="mt-6 border-t border-surface-200-800 pt-5">
      <p class="text-sm text-muted">{m.invitation_block_prompt({ gm })}</p>
      <MAButton
        variant="secondary"
        size="sm"
        class="mt-3 border-surface-200-800 font-semibold text-error-alert"
        onclick={() => (blockOpen = true)}>{m.invitation_block_open({ gm })}</MAButton
      >
    </div>
  </div>
</section>

<DialogShell
  bind:open={blockOpen}
  role="alertdialog"
  sheet
  lazy={false}
  initialFocusEl={cancel}
  description={m.invitation_block_help()}
>
  {#snippet title()}{m.invitation_block_title({ gm })}{/snippet}
  <DialogActions
    class="mt-6"
    cancel={m.confirm_cancel()}
    cancelAttributes={{ 'data-block-cancel': '' }}
  >
    {#snippet confirmButton()}
      <InvitationAction
        action="?/block"
        gmId={invitation.gmId}
        variant="danger"
        label={m.invitation_block()}
        onsuccess={() => (blockOpen = false)}
      />
    {/snippet}
  </DialogActions>
</DialogShell>
