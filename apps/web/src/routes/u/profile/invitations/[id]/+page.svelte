<script lang="ts">
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
  import InvitationAction from '#lib/components/InvitationAction.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  let { data, form } = $props();
  const invitation = $derived(data.invitation);
  const locale = getLocale();
  const pending = $derived(
    invitation.status === 'pending' && new Date(invitation.expiresAt) > new Date(),
  );
  const status = $derived(
    {
      pending: m.invitation_status_pending,
      accepted: m.invitation_status_accepted,
      declined: m.invitation_status_declined,
      expired: m.invitation_status_expired,
      cancelled: m.invitation_status_cancelled,
    }[invitation.status](),
  );
</script>

<svelte:head
  ><title>{m.invitation_title()} · Mesa Aberta</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<section class="mx-auto max-w-2xl py-8 md:py-12">
  <Breadcrumbs
    items={[{ label: m.nav_my_tables(), href: '/u/tables' }, { label: m.invitation_title() }]}
  />
  <div class="mt-6 rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8">
    <h1 class="text-3xl font-semibold">{m.invitation_title()}</h1>
    <p class="mt-4">
      {m.invitation_from({ gm: invitation.gmUsername || '', title: invitation.table.title })}
    </p>
    <p class="mt-3 font-semibold">
      {pending ? status : invitation.status === 'pending' ? m.invitation_status_expired() : status}
    </p>
    {#if form && ('error' in form || ('form' in form && !form.form.valid))}<p
        role="alert"
        class="mt-3 text-error-alert"
      >
        {m.invitation_unavailable()}
      </p>{/if}
    {#if pending}
      <p class="mt-3 text-muted">{m.invitation_decision_help()}</p>
      <p class="mt-3 text-sm text-muted">
        {m.invitation_deadline({
          date: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
            new Date(invitation.expiresAt),
          ),
        })}
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <InvitationAction action="?/accept" label={m.invitation_accept()} /><InvitationAction
          action="?/decline"
          label={m.invitation_decline()}
        />
      </div>
    {/if}
    {#if invitation.status === 'accepted'}<a
        class="mt-6 inline-block link-underline"
        href={`/t/${invitation.table.slug}`}>{m.manage_view_page()}</a
      >{/if}
    <div class="mt-6 border-t border-surface-200-800 pt-6">
      <p class="mb-3 text-sm text-muted">{m.invitation_block_help()}</p>
      <InvitationAction action="?/block" gmId={invitation.gmId} label={m.invitation_block()} />
    </div>
  </div>
</section>
