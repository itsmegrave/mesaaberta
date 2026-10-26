<script lang="ts">
  // "Esconder do perfil", a toggle in the details of one of the owner's badges: pressed, the badge is
  // hidden from their public profile; pressing it again shows it.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { badgeVisibilitySchema } from '#lib/badges/visibility.js';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';

  let { badgeId, hidden }: { badgeId: string; hidden: boolean } = $props();

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { badgeId, hidden: '1' },
    schema: badgeVisibilitySchema,
    onSuccess: () => {},
    onFailure: () => toast.error(m.badges_visibility_failed()),
    errorMessage: m.badges_visibility_failed,
  });
</script>

<MAForm action="?/badgeVisibility" onsubmit={form.submit}>
  <input type="hidden" name="badgeId" value={badgeId} />
  <!-- The value is what the click does: hiding a shown badge sends 1, showing a hidden one sends 0. -->
  <input type="hidden" name="hidden" value={hidden ? '0' : '1'} />
  <MAButton
    type="submit"
    size="sm"
    variant="secondary"
    controller={form}
    aria-pressed={hidden}
    class="w-full gap-2 {hidden ? 'preset-tonal' : ''}"
  >
    <!-- Busy at once while it saves; the spinner takes the eye's place if it is slow. -->
    {#if !form.delayed}<Icon name={hidden ? 'eye-off' : 'eye'} size={20} />{/if}
    {m.badges_hide()}
  </MAButton>
</MAForm>
