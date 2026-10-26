<script lang="ts">
  // "Quem cuida do parceiro" under the edit form: the accounts that look after the partner (who sent
  // it first), the invites that wait, and inviting by @username. Each row's menu takes an account
  // off, or on one's own row leaves (not when one is the last). Every action asks the server, which
  // authorizes it again; the page reloads its data afterwards.
  import ConfirmAction from './ConfirmAction.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { toast } from '#lib/toaster.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import {
    MAX_PARTNER_OWNERS,
    partnerInvitationIdSchema,
    partnerInviteSchema,
  } from '@mesaaberta/core/partners/owners';

  type Owner = { profileId: string; username: string; since: Date | string; submitter: boolean };
  type Invitation = {
    id: string;
    username: string;
    createdAt: Date | string;
    expiresAt: Date | string;
  };

  let {
    partner,
    owners,
    invitations,
    you,
  }: {
    partner: string;
    owners: Owner[];
    invitations: Invitation[];
    /** The viewer's profile id: their row says "Você" and its menu leaves. */
    you: string;
  } = $props();

  const date = (value: Date | string) =>
    new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(new Date(value));
  const full = $derived(owners.length + invitations.length >= MAX_PARTNER_OWNERS);

  const form = actionForm<{ username: string }>({
    initial: { username: '' },
    schema: partnerInviteSchema,
    errorMessage: m.partner_owners_err_generic,
    onSuccess: () => {
      toast.success(m.partner_owners_invite_sent());
      form.reset({ username: '' });
    },
  });
  const { draft } = form;
  // The name as typed, for "Não foi possível convidar @nome": the server never says which it was.
  let tried = $state('');
  const inviteError = $derived.by(() => {
    const code = form.errors.username?.[0] ?? form.errors._errors?.[0] ?? form.message?.code;
    if (!code) return undefined;
    if (code === 'required') return m.partner_owners_err_required();
    if (code === 'unavailable')
      return m.partner_owners_err_unavailable({ username: atHandle(tried) });
    if (code === 'too_many') return m.partner_owners_full({ max: MAX_PARTNER_OWNERS });
    if (code === 'rate_limited') return m.partner_owners_err_rate_limited();
    return m.partner_owners_err_generic();
  });

  // The line under a name: "Você · cadastrou o parceiro", "cadastrou o parceiro" or since when.
  const about = (owner: Owner) => {
    const role = owner.submitter
      ? m.partner_owners_submitter()
      : m.partner_owners_since({ date: date(owner.since) });
    return owner.profileId === you ? `${m.partner_owners_you()} · ${role}` : role;
  };

  // The confirmation open now: taking someone off, or leaving.
  let confirming = $state<{ owner: Owner; leave: boolean } | null>(null);
  const items = (owner: Owner): KebabItem[] => {
    const own = owner.profileId === you;
    if (own && owners.length === 1) return [];
    return [
      {
        id: own ? 'leave' : 'remove',
        label: own ? m.partner_owners_leave() : m.partner_owners_remove(),
        icon: own ? 'game-icons:exit-door' : 'trash',
        destructive: true,
        onselect: () => (confirming = { owner, leave: own }),
      },
    ];
  };
</script>

<FormSection
  id="owners-section"
  icon="game-icons:meeple"
  title={m.partner_owners_title()}
  hint={m.partner_owners_hint({ max: MAX_PARTNER_OWNERS })}
>
  <ul class="grid gap-3">
    {#each owners as owner (owner.profileId)}
      {@const menu = items(owner)}
      <li class="flex items-center gap-3 rounded-lg border border-surface-200-800 p-3">
        <MAAvatar name={owner.username} size={36} />
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold">{atHandle(owner.username)}</p>
          <p class="text-sm text-muted">
            {about(owner)}
          </p>
        </div>
        {#if menu.length > 0}
          <KebabMenu name={atHandle(owner.username)} items={menu} />
        {/if}
      </li>
    {/each}
    {#each invitations as invitation (invitation.id)}
      <li
        class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-surface-200-800 p-3"
      >
        <MAAvatar name={invitation.username} size={36} />
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap items-center gap-2">
            <span class="truncate font-semibold">{atHandle(invitation.username)}</span>
            <Pill tone="muted">{m.partner_owners_pending()}</Pill>
          </p>
          <p class="text-sm text-muted">
            {m.partner_owners_invited({
              sent: date(invitation.createdAt),
              until: date(invitation.expiresAt),
            })}
          </p>
        </div>
        <PostButton
          action="?/cancelInvite"
          fields={{ invitationId: invitation.id }}
          schema={partnerInvitationIdSchema}
          errorMessage={m.partner_owners_err_generic}
          success={m.partner_owners_cancelled()}
          onFailure={() => toast.error(m.partner_owners_err_generic())}
          variant="secondary"
          size="sm"
          buttonClass="font-semibold">{m.partner_owners_cancel_invite()}</PostButton
        >
      </li>
    {/each}
  </ul>

  {#if full}
    <p class="text-sm text-muted">{m.partner_owners_full({ max: MAX_PARTNER_OWNERS })}</p>
  {:else}
    <MAForm
      action="?/invite"
      onsubmit={(event) => {
        tried = $draft.username;
        form.submit(event);
      }}
      class="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div class="min-w-0 flex-1">
        <FormField id="owner-username" label={m.partner_owners_invite_label()} error={inviteError}>
          {#snippet children(control)}
            <TextInput
              id="owner-username"
              name="username"
              bind:value={$draft.username}
              placeholder="@usuario"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              {...control}
            />
          {/snippet}
        </FormField>
      </div>
      <MAButton type="submit" variant="secondary" controller={form} class="font-semibold sm:mb-0"
        >{m.partner_owners_invite_submit()}</MAButton
      >
    </MAForm>
  {/if}
</FormSection>

{#if confirming}
  <ConfirmAction
    open={true}
    onclose={() => (confirming = null)}
    action={confirming.leave ? '?/leave' : '?/removeOwner'}
    profileId={confirming.owner.profileId}
    title={confirming.leave
      ? m.partner_owners_leave_title({ partner })
      : m.partner_owners_remove_title({ username: atHandle(confirming.owner.username), partner })}
    text={confirming.leave ? m.partner_owners_leave_text() : m.partner_owners_remove_text()}
    label={confirming.leave ? m.partner_owners_leave_confirm() : m.partner_owners_remove_confirm()}
    success={confirming.leave ? undefined : m.partner_owners_removed()}
  />
{/if}
