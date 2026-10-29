<script lang="ts">
  // A person in Procuro mesa: the avatar, the name (or the @usuário) as the card's one link to the
  // profile, the line they wrote for GMs, their favorite systems and a line of facts. Draws only
  // what it is given.
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { linkedCardClass } from '#lib/components/ui/MediaCard.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    player,
    facts,
  }: {
    player: {
      username: string;
      name: string | null;
      avatarUrl: string | null;
      note: string | null;
      systems: { name: string; slug: string }[];
      moreSystems: number;
    };
    /** The line of facts: since when they are looking, how many tables they played. */
    facts: string;
  } = $props();
</script>

<article class="{linkedCardClass} min-w-0 gap-4 p-5">
  <div class="flex items-start gap-4">
    <MAAvatar
      src={player.avatarUrl}
      name={player.name ?? player.username}
      size={56}
      class="shrink-0"
    />
    <div class="min-w-0 flex-1">
      <h3 class="truncate text-xl leading-tight font-semibold tracking-tight">
        <a
          href="/u/{player.username}"
          class="no-underline after:absolute after:inset-0 focus-visible:outline-none"
          >{player.name ?? `@${player.username}`}</a
        >
      </h3>
      {#if player.name}<p class="mt-0.5 truncate text-sm text-muted">@{player.username}</p>{/if}
    </div>
  </div>
  {#if player.note}<p class="line-clamp-3 text-sm">{player.note}</p>{/if}
  {#if player.systems.length > 0}
    <ul aria-label={m.players_systems_label()} class="flex flex-wrap gap-1.5">
      {#each player.systems as system (system.slug)}
        <li
          class="inline-flex h-6.5 items-center rounded-full bg-surface-wash px-2.5 text-xs font-semibold"
        >
          {system.name}
        </li>
      {/each}
      {#if player.moreSystems > 0}
        <li class="inline-flex h-6.5 items-center px-1 text-xs font-semibold text-muted">
          {m.directory_people_more({ count: player.moreSystems })}
        </li>
      {/if}
    </ul>
  {/if}
  <div class="mt-auto flex items-center justify-between gap-3 border-t border-surface-200-800 pt-4">
    <span class="text-sm font-medium text-muted">{facts}</span>
    <span
      aria-hidden="true"
      class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-wash"
    >
      <Icon name="chevron-right" size={18} />
    </span>
  </div>
</article>
