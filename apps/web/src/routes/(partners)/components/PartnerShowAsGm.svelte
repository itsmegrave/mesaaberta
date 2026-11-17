<script lang="ts">
  // "Mostrar meu perfil em Quem mestra" under "Quem cuida": each person who looks after the partner
  // decides for themselves whether its page lists them under Quem mestra. It only shows people whose
  // profile says they run games; the server checks that again.
  import PostButton from '#lib/components/PostButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import { partnerShowAsGmFormSchema } from '@mesaaberta/core/places/partner-links';

  let { shown }: { shown: boolean } = $props();
</script>

<div
  class="flex flex-col gap-3 rounded-lg border border-surface-200-800 p-4 sm:flex-row sm:items-center"
>
  <div class="min-w-0 flex-1">
    <p class="font-semibold">{m.partner_show_as_gm_title()}</p>
    <p class="text-sm text-muted">{m.partner_show_as_gm_hint()}</p>
  </div>
  <PostButton
    action="?/showAsGm"
    fields={{ show: String(!shown) }}
    schema={partnerShowAsGmFormSchema}
    errorMessage={m.partner_owners_err_generic}
    success={shown ? m.partner_show_as_gm_hidden() : m.partner_show_as_gm_shown()}
    onFailure={() => toast.error(m.partner_owners_err_generic())}
    variant={shown ? 'secondary' : 'primary'}
    size="sm"
    buttonClass="shrink-0 font-semibold"
    >{shown ? m.partner_show_as_gm_off() : m.partner_show_as_gm_on()}</PostButton
  >
</div>
