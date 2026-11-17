<script lang="ts">
  // "Quem mestra na casa" under the place's edit form: the people the place names as its house GMs,
  // the invites that wait, and inviting by @username. A person shows on the place's page only once
  // they accept, and can leave from their profile. Every action asks the server, which authorizes
  // it again; the page reloads its data afterwards.
  import FormField from '#lib/components/ui/FormField.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
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
    MAX_PLACE_HOSTS,
    placeHostInvitationIdSchema,
    placeHostInviteSchema,
    placeHostSchema,
  } from '@mesaaberta/core/places/hosts';

  type Host = { profileId: string; username: string; since: Date | string };
  type Invitation = {
    id: string;
    username: string;
    createdAt: Date | string;
    expiresAt: Date | string;
  };

  let { hosts, invitations }: { hosts: Host[]; invitations: Invitation[] } = $props();

  const date = (value: Date | string) =>
    new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short' }).format(new Date(value));
  const full = $derived(hosts.length + invitations.length >= MAX_PLACE_HOSTS);

  const form = actionForm<{ username: string }>({
    initial: { username: '' },
    schema: placeHostInviteSchema,
    errorMessage: m.place_hosts_err_generic,
    onSuccess: () => {
      toast.success(m.place_hosts_invite_sent());
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
    if (code === 'unavailable') return m.place_hosts_err_unavailable({ username: atHandle(tried) });
    if (code === 'too_many') return m.place_hosts_full({ max: MAX_PLACE_HOSTS });
    if (code === 'rate_limited') return m.partner_owners_err_rate_limited();
    return m.place_hosts_err_generic();
  });
</script>

<FormSection
  id="hosts-section"
  icon="game-icons:pointy-hat"
  title={m.place_hosts_title()}
  hint={m.place_hosts_hint({ max: MAX_PLACE_HOSTS })}
>
  {#if hosts.length + invitations.length > 0}
    <ul class="grid gap-3">
      {#each hosts as host (host.profileId)}
        <li class="flex flex-wrap items-center gap-3 rounded-lg border border-surface-200-800 p-3">
          <MAAvatar name={host.username} size={36} />
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-2">
              <span class="truncate font-semibold">{atHandle(host.username)}</span>
              <Pill tone="primary">{m.place_hosts_house()}</Pill>
            </p>
            <p class="text-sm text-muted">{m.place_hosts_since({ date: date(host.since) })}</p>
          </div>
          <PostButton
            action="?/removeHost"
            fields={{ profileId: host.profileId }}
            schema={placeHostSchema}
            errorMessage={m.place_hosts_err_generic}
            success={m.place_hosts_removed()}
            onFailure={() => toast.error(m.place_hosts_err_generic())}
            variant="secondary"
            size="sm"
            buttonClass="font-semibold">{m.place_hosts_remove()}</PostButton
          >
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
              {m.place_hosts_invited({ until: date(invitation.expiresAt) })}
            </p>
          </div>
          <PostButton
            action="?/cancelHostInvite"
            fields={{ invitationId: invitation.id }}
            schema={placeHostInvitationIdSchema}
            errorMessage={m.place_hosts_err_generic}
            success={m.partner_owners_cancelled()}
            onFailure={() => toast.error(m.place_hosts_err_generic())}
            variant="secondary"
            size="sm"
            buttonClass="font-semibold">{m.partner_owners_cancel_invite()}</PostButton
          >
        </li>
      {/each}
    </ul>
  {/if}

  {#if full}
    <p class="text-sm text-muted">{m.place_hosts_full({ max: MAX_PLACE_HOSTS })}</p>
  {:else}
    <MAForm
      action="?/inviteHost"
      onsubmit={(event) => {
        tried = $draft.username;
        form.submit(event);
      }}
      class="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div class="min-w-0 flex-1">
        <FormField id="host-username" label={m.partner_owners_invite_label()} error={inviteError}>
          {#snippet children(control)}
            <TextInput
              id="host-username"
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
      <MAButton type="submit" variant="secondary" controller={form} class="font-semibold"
        >{m.partner_owners_invite_submit()}</MAButton
      >
    </MAForm>
  {/if}
</FormSection>
