<script lang="ts">
  // A person in an admin page: their public profile, the link to their admin page and, when they are
  // suspended, the badge that says so.
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';

  let { person }: { person: { id: string; username: string | null; status?: string | null } } =
    $props();
</script>

<UserLink
  username={person.username}
  label={person.username ? atHandle(person.username) : m.admin_profile_no_username()}
  class="font-semibold"
/>
<a class="ml-2 anchor text-sm" href={`/admin/users/${person.id}`}>{m.admin_user_title()}</a>
{#if person.status === 'suspended'}
  <StatusBadge status="user:banned" />
{/if}
