<script lang="ts">
  // A person in Quem mestra: the avatar, the name (or the @usuário) as the card's one link to the
  // profile, the role tag and the badges, the score, the bio in two lines, the systems they ran
  // most, a line of facts, and a footer with the tables open now, a link to them on /tables.
  // Draws only what it is given.
  import BadgeMedal from '#lib/components/ui/BadgeMedal.svelte';
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import TableRoleTag from '#lib/components/ui/TableRoleTag.svelte';
  import { linkedCardClass } from '#lib/components/ui/MediaCard.svelte';
  import { publicBadges, type HeldBadge } from '#lib/badges/shown.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    gm,
    facts,
  }: {
    gm: {
      username: string;
      name: string | null;
      avatarUrl: string | null;
      bio: string | null;
      tableRole: 'gm' | 'both';
      rating: { score: number | null; count: number; isNew: boolean };
      badges: HeldBadge[] | null;
      openTables: number;
      systems: { name: string; slug: string; tables: number }[];
      moreSystems: number;
    };
    /** The line of facts (`gmFacts`). */
    facts: string;
  } = $props();

  const badges = $derived(gm.badges ? publicBadges(gm.badges) : []);
</script>

<article class="{linkedCardClass} min-w-0 gap-4 p-5">
  <div class="flex items-start gap-4">
    <MAAvatar src={gm.avatarUrl} name={gm.name ?? gm.username} size={56} class="shrink-0" />
    <div class="min-w-0 flex-1">
      <h3 class="truncate text-xl leading-tight font-semibold tracking-tight">
        <a
          href="/u/{gm.username}"
          class="no-underline after:absolute after:inset-0 focus-visible:outline-none"
          >{gm.name ?? `@${gm.username}`}</a
        >
      </h3>
      {#if gm.name}<p class="mt-0.5 truncate text-sm text-muted">@{gm.username}</p>{/if}
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <TableRoleTag tableRole={gm.tableRole} class="h-5 px-2" />
        {#each badges as badge (badge.badgeId)}
          <span title={badge.look.name()}>
            <span class="sr-only">{badge.look.name()}</span>
            <BadgeMedal icon={badge.look.icon} mark={badge.look.mark} size={20} />
          </span>
        {/each}
      </div>
    </div>
    <span
      class="inline-flex h-8 shrink-0 items-center rounded-full border border-surface-200-800 px-3"
    >
      <GmRating rating={gm.rating} variant="short" />
    </span>
  </div>
  {#if gm.bio}<p class="line-clamp-2 text-sm text-muted">{gm.bio}</p>{/if}
  {#if gm.systems.length > 0}
    <ul aria-label={m.gms_systems_label()} class="flex flex-wrap gap-1.5">
      {#each gm.systems as system (system.slug)}
        <li
          class="inline-flex h-6.5 items-center rounded-full bg-surface-wash px-2.5 text-xs font-semibold"
        >
          {system.name}<span class="font-medium text-muted">&nbsp;· {system.tables}</span>
        </li>
      {/each}
      {#if gm.moreSystems > 0}
        <li class="inline-flex h-6.5 items-center px-1 text-xs font-semibold text-muted">
          {m.directory_people_more({ count: gm.moreSystems })}
        </li>
      {/if}
    </ul>
  {/if}
  <p class="text-sm font-medium text-muted">{facts}</p>
  <div class="mt-auto flex items-center justify-between gap-3 border-t border-surface-200-800 pt-4">
    {#if gm.openTables > 0}
      <!-- Above the card's link: this one goes to the person's open tables. -->
      <a
        href="/tables?gm={gm.username}"
        class="relative z-10 font-semibold text-lamp underline-offset-4 hover:underline"
        >{m.gms_open_now({ count: gm.openTables })}</a
      >
    {:else}
      <span class="font-semibold text-muted">{m.gms_open_now({ count: 0 })}</span>
    {/if}
    <span
      aria-hidden="true"
      class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-wash"
    >
      <Icon name="chevron-right" size={18} />
    </span>
  </div>
</article>
