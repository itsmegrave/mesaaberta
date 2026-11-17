<script lang="ts">
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';

  /**
   * One person in a directory's compact list (who runs a system): the 44px avatar, the name linking
   * to the profile, one muted line and the GM's score as a pill.
   */
  let {
    person,
    detail,
  }: {
    person: {
      username: string;
      avatarUrl: string | null;
      /** The GM's score; none draws no pill (a partner's "Quem mestra"). */
      rating?: { score: number | null; count: number; isNew: boolean };
    };
    /** The muted line under the name ("9 mesas deste sistema"). */
    detail: string;
  } = $props();
</script>

<div class="flex items-center gap-4 rounded-lg border border-surface-200-800 bg-panel p-4">
  <MAAvatar src={person.avatarUrl} name={person.username} size={44} />
  <div class="min-w-0 flex-1">
    <a
      href="/u/{person.username}"
      class="block truncate text-lg font-semibold underline decoration-surface-200-800 underline-offset-4"
      >@{person.username}</a
    >
    <p class="text-sm font-medium text-muted">{detail}</p>
    <!-- On a phone the score sits under the name; the pill needs the width a wider screen has. -->
    {#if person.rating}
      <span class="sm:hidden"><GmRating rating={person.rating} variant="short" /></span>
    {/if}
  </div>
  {#if person.rating}
    <span class="hidden shrink-0 sm:block"><GmRating rating={person.rating} variant="pill" /></span>
  {/if}
</div>
