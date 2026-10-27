<script lang="ts">
  // In place of "Mesas de quem você segue" while you follow nobody: the people you already played
  // with, each with Seguir.
  import FollowButton from '#lib/components/FollowButton.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { routes } from '@mesaaberta/core/routes';
  import { m } from '#lib/paraglide/messages.js';

  type Person = {
    id: string;
    username: string;
    avatarUrl: string | null;
    ran: number;
    played: number;
  };
  let { people }: { people: Person[] } = $props();

  const met = (person: Person) =>
    person.ran > 0
      ? m.home_suggest_ran({ count: person.ran })
      : m.home_suggest_played({ count: person.played });
</script>

<section
  aria-labelledby="home-suggest"
  class="rounded-lg border border-surface-200-800 bg-panel p-4 md:p-6"
>
  <h2 id="home-suggest" class="text-xl font-semibold tracking-tight md:text-2xl">
    {m.home_row_followed()}
  </h2>
  <p class="mt-2 max-w-xl text-muted">{m.home_suggest_lede()}</p>
  {#if people.length > 0}
    <h3 class="mt-5 font-semibold">{m.home_suggest_title()}</h3>
    <ul class="mt-3 flex flex-col divide-y divide-surface-200-800">
      {#each people as person (person.id)}
        <li class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <MAAvatar src={person.avatarUrl} name={person.username} size={40} />
          <span class="min-w-0 flex-1">
            <a href={routes.profile(person.username)} class="block truncate font-semibold"
              >{atHandle(person.username)}</a
            >
            <span class="block text-sm text-muted">{met(person)}</span>
          </span>
          <FollowButton
            profileId={person.id}
            username={person.username}
            following={false}
            size="sm"
          />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="mt-4 text-sm text-muted">{m.home_suggest_none()}</p>
  {/if}
</section>
