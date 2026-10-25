<script lang="ts">
  // The eye on one of the owner's earned badges: hides it from their public profile, or shows it again.
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
  <button
    type="submit"
    class="btn size-10 shrink-0 rounded-lg p-0 hover:preset-tonal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    aria-pressed={hidden}
    aria-label={hidden ? m.badges_show() : m.badges_hide()}
    title={hidden ? m.badges_show() : m.badges_hide()}
    disabled={form.pending}
  >
    <Icon name={hidden ? 'eye-off' : 'eye'} size={20} />
  </button>
</MAForm>
