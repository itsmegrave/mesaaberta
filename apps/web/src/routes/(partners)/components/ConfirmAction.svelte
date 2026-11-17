<script lang="ts">
  // A step of "Quem cuida do parceiro" that asks first (taking an account off, leaving): the dialog
  // says what happens, focus starts on "Cancelar" and only the red button posts `action` with the
  // account. A bottom sheet on a phone. Closing, either way, calls `onclose`.
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import { partnerOwnerSchema } from '@mesaaberta/core/partners/owners';

  let {
    open = $bindable(true),
    onclose,
    action,
    profileId,
    title: titleText,
    text,
    label,
    success,
  }: {
    open?: boolean;
    onclose: () => void;
    action: string;
    profileId: string;
    title: string;
    text: string;
    label: string;
    success?: string;
  } = $props();

  const cancel = () => document.querySelector<HTMLElement>('[data-owner-cancel]');
  const errors: Record<string, () => string> = {
    last_owner: m.partner_owners_err_last_owner,
  };
</script>

<DialogShell
  bind:open
  role="alertdialog"
  sheet
  lazy={false}
  initialFocusEl={cancel}
  description={text}
  onOpenChange={(next) => {
    if (!next) onclose();
  }}
>
  {#snippet title()}{titleText}{/snippet}
  <DialogActions
    class="mt-6"
    cancel={m.confirm_cancel()}
    cancelAttributes={{ 'data-owner-cancel': '' }}
  >
    {#snippet confirmButton()}
      <PostButton
        {action}
        fields={{ profileId }}
        schema={partnerOwnerSchema}
        errorMessage={m.partner_owners_err_generic}
        {success}
        onSuccess={() => {
          open = false;
          onclose();
        }}
        onFailure={(form) => {
          const code = form?.errors?.profileId?.[0] ?? form?.message?.code;
          toast.error((code && errors[code]?.()) || m.partner_owners_err_generic());
          open = false;
          onclose();
        }}
        buttonClass="{buttonClass('danger', 'md')} font-semibold">{label}</PostButton
      >
    {/snippet}
  </DialogActions>
</DialogShell>
