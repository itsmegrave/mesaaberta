<script lang="ts">
  // "Mensagens e convites": the switch for direct messages (it saves on its own), whether tables
  // may invite this person, and who is blocked from doing it.
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { tick } from 'svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import InvitationAction from '#lib/components/InvitationAction.svelte';
  import SettingsSection from '../components/ui/SettingsSection.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { toast } from '#lib/toaster.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { directMessagesSchema } from '@mesaaberta/core/messages/schema';
  import { invitationFormSchema, type InvitationFormValues } from '#lib/invitations/schema.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
  const heading = 'text-2xl leading-tight font-semibold tracking-tight';

  let messagingForm = $state<HTMLFormElement>();
  const restoreMessaging = () => {
    messaging.change('enabled', !messaging.values.enabled);
    toast.error(m.messages_setting_failed());
  };
  // svelte-ignore state_referenced_locally
  const messaging = actionForm({
    initial: data.messagesForm.data,
    schema: directMessagesSchema,
    refresh: false,
    domain: 'account',
    onSuccess: () => toast.success(m.messages_setting_saved()),
    onFailure: restoreMessaging,
    onError: restoreMessaging,
    errorMessage: m.messages_setting_failed,
  });

  // "Receber convites" saves as soon as it flips, like the messages switch.
  let invitingForm = $state<HTMLFormElement>();
  const restoreInviting = () => {
    inviting.change('enabled', inviting.values.enabled === 'true' ? 'false' : 'true');
    toast.error(m.invitation_unavailable());
  };
  // svelte-ignore state_referenced_locally
  const inviting = actionForm({
    initial: {
      username: '',
      invitationId: '',
      gmId: '',
      enabled: data.invitationPreferences.enabled ? 'true' : 'false',
      blocked: 'true',
    } as InvitationFormValues,
    schema: invitationFormSchema,
    domain: 'account',
    onSuccess: () => toast.success(m.invitation_saved()),
    onFailure: restoreInviting,
    onError: restoreInviting,
    errorMessage: m.invitation_unavailable,
  });
</script>

<SettingsSection title={m.profile_section_messages()} lede={m.profile_section_messages_lede()} />

<section aria-labelledby="direct-messages" class={card}>
  <h3 id="direct-messages" class={heading}>{m.messages_setting_title()}</h3>
  <MAForm bind:element={messagingForm} action="?/messages" onsubmit={messaging.submit} class="mt-4">
    <Switch
      checked={messaging.values.enabled}
      disabled={messaging.pending}
      onCheckedChange={(event) => {
        messaging.change('enabled', event.checked);
        void tick().then(() => messagingForm?.requestSubmit());
      }}
      class="flex items-center justify-between gap-4"
    >
      <Switch.Label class="font-semibold">{m.messages_setting_label()}</Switch.Label>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.HiddenInput />
      <input type="hidden" name="enabled" value={String(messaging.values.enabled)} />
    </Switch>
  </MAForm>
  <p class="mt-3 max-w-prose text-muted">{m.messages_setting_help()}</p>
</section>

<section aria-labelledby="invitation-settings" class={card}>
  <h3 id="invitation-settings" class={heading}>{m.invitation_settings_title()}</h3>
  <p class="mt-3 text-muted">{m.invitation_settings_help()}</p>
  {#if result && ('error' in result || ('form' in result && 'invitationId' in result.form.data && !result.form.valid))}<p
      role="alert"
      class="mt-3 text-error-alert"
    >
      {m.invitation_unavailable()}
    </p>{/if}
  <MAForm
    bind:element={invitingForm}
    action="?/invitations"
    onsubmit={inviting.submit}
    class="mt-4"
  >
    <Switch
      checked={inviting.values.enabled === 'true'}
      disabled={inviting.pending}
      onCheckedChange={(event) => {
        inviting.change('enabled', event.checked ? 'true' : 'false');
        void tick().then(() => invitingForm?.requestSubmit());
      }}
      class="flex items-center justify-between gap-4"
    >
      <Switch.Label class="font-semibold">{m.invitation_enable()}</Switch.Label>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.HiddenInput />
      <input type="hidden" name="enabled" value={inviting.values.enabled} />
    </Switch>
  </MAForm>
  <h4 class="mt-6 text-lg font-semibold">{m.invitation_blocks_title()}</h4>
  {#if data.invitationPreferences.blocks.length === 0}<p class="mt-2 text-muted">
      {m.invitation_blocks_empty()}
    </p>{:else}
    <ul class="mt-3 divide-y divide-surface-200-800">
      {#each data.invitationPreferences.blocks as block (block.gmId)}
        <li class="flex flex-wrap items-center justify-between gap-3 py-3">
          <span class="font-semibold">{atHandle(block.username || '')}</span><InvitationAction
            action="?/invitationBlock"
            gmId={block.gmId}
            blocked={false}
            label={m.invitation_unblock()}
          />
        </li>
      {/each}
    </ul>
  {/if}
</section>
