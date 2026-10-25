<script lang="ts">
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { invitationFormSchema } from '#lib/invitations/schema.js';
  import MAForm from './ui/MAForm.svelte';
  import FormField from './ui/FormField.svelte';
  import TextInput from './ui/TextInput.svelte';
  import MAButton from './ui/MAButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { registrationError } from '#lib/tables/registration-errors.js';
  import { toast } from '#lib/toaster.js';
  let {
    action,
    label,
    username = false,
    invitationId = '',
    gmId = '',
    enabled = true,
    blocked = true,
  }: {
    action: string;
    label: string;
    username?: boolean;
    invitationId?: string;
    gmId?: string;
    enabled?: boolean;
    blocked?: boolean;
  } = $props();
  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: {
      username: '',
      invitationId,
      gmId,
      enabled: String(enabled) as 'true' | 'false',
      blocked: String(blocked) as 'true' | 'false',
    },
    schema: invitationFormSchema,
    domain:
      action.includes('invitations') || action.includes('invitationBlock') ? 'account' : 'table',
    errorMessage: m.invitation_unavailable,
    onSuccess: () => toast.success(m.invitation_saved()),
    onFailure: (updated) =>
      toast.error(
        updated?.message?.code === 'rate_limited'
          ? registrationError('rate_limited', updated.message.retryAfter)
          : m.invitation_unavailable(),
      ),
  });
  const { draft } = form;
</script>

<MAForm {action} onsubmit={form.submit} class="grid gap-3">
  {#if username}
    <FormField
      label={m.invitation_username()}
      id="invitation-username"
      error={form.errors.username?.[0] ? m.invitation_unavailable() : undefined}
    >
      {#snippet children(control)}
        <TextInput
          id="invitation-username"
          name="username"
          bind:value={$draft.username}
          placeholder="@username"
          required
          autocomplete="off"
          autocapitalize="none"
          {...control}
        />
      {/snippet}
    </FormField>
  {/if}
  <input type="hidden" name="invitationId" value={invitationId} />
  <input type="hidden" name="gmId" value={gmId} />
  <input type="hidden" name="enabled" value={String(enabled)} />
  <input type="hidden" name="blocked" value={String(blocked)} />
  <div>
    <MAButton type="submit" variant="secondary" controller={form} class="font-semibold"
      >{label}</MAButton
    >
  </div>
</MAForm>
