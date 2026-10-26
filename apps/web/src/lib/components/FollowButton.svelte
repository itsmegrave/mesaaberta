<script lang="ts">
  // Seguir / Seguindo next to someone: on a profile, a table's GM row and in "Seguindo". One button
  // that follows or stops following, pressed while following, its name saying what a press does.
  // A visitor gets a link to Entrar that comes back here.
  import { page } from '$app/state';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { followSchema } from '@mesaaberta/core/follows/schema';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    action = '?/follow',
    profileId,
    username,
    following: initial,
    signedIn = true,
    size = 'md',
    label,
    class: className = '',
  }: {
    action?: string;
    profileId: string;
    username: string;
    following: boolean;
    signedIn?: boolean;
    /** `sm` (44px) on a GM row and in a list; `md` (48px) on a profile. */
    size?: 'md' | 'sm';
    /** Instead of Seguir / Seguindo: "Deixar de seguir" in the list of people one follows. */
    label?: string;
    class?: string;
  } = $props();

  // What the page says, until a press changes it; a new page load says it again.
  let following = $derived(initial);

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { profileId, follow: initial ? 'false' : 'true' },
    schema: followSchema,
    domain: 'account',
    errorMessage: m.follow_failed,
    onSuccess: () => {
      following = !following;
      form.reset({ profileId, follow: following ? 'false' : 'true' });
    },
    onFailure: () => toast.error(m.follow_failed()),
    onError: () => toast.error(m.follow_failed()),
  });

  const handle = $derived(atHandle(username));
  const look = $derived(
    `${buttonClass(following || label ? 'secondary' : 'primary', size)} gap-2 font-semibold ${className}`,
  );
</script>

{#if !signedIn}
  <a
    href="/login?next={encodeURIComponent(page.url.pathname)}"
    aria-label={m.follow_person({ username: handle })}
    class="{buttonClass('primary', size)} gap-2 font-semibold no-underline {className}"
  >
    <Icon name="plus" size={16} />
    {m.follow()}
  </a>
{:else}
  <MAForm {action} onsubmit={form.submit}>
    <input type="hidden" name="profileId" value={profileId} />
    <input type="hidden" name="follow" value={following ? 'false' : 'true'} />
    <MAButton
      type="submit"
      size="custom"
      controller={form}
      aria-pressed={label ? undefined : following}
      aria-label={following
        ? m.follow_stop_person({ username: handle })
        : m.follow_person({ username: handle })}
      class={look}
    >
      {#if label}
        {label}
      {:else if following}
        <Icon name="check" size={16} />
        {m.following()}
      {:else}
        <Icon name="plus" size={16} />
        {m.follow()}
      {/if}
    </MAButton>
  </MAForm>
{/if}
