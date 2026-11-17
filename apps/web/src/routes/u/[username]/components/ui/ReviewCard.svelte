<script lang="ts">
  // One comment a player chose to show on the GM's profile: who wrote it, the score in stars, the
  // table it was about, and the comment in quotes.
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';

  let {
    review,
  }: {
    review: {
      username: string;
      avatarUrl: string | null;
      score: number;
      text: string;
      table: { title: string; slug: string };
    };
  } = $props();
</script>

<article class="flex h-full flex-col gap-3 rounded-lg border border-surface-200-800 bg-panel p-5">
  <div class="flex items-center gap-3">
    <MAAvatar src={review.avatarUrl} name={review.username} size={40} />
    <a
      href="/u/{review.username}"
      class="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
      >{atHandle(review.username)}</a
    >
    <span class="flex shrink-0 text-lamp">
      <span class="sr-only">{m.rating_score_label({ score: review.score })}</span>
      {#each [1, 2, 3, 4, 5] as star (star)}
        <Icon name="star" size={16} class={star <= review.score ? '' : 'text-surface-300-700'} />
      {/each}
    </span>
  </div>
  <p class="text-xs font-semibold text-muted">
    {m.public_profile_review_played()}
    <a href="/t/{review.table.slug}" class="underline decoration-surface-300-700"
      >{review.table.title}</a
    >
  </p>
  <!-- Plain text in the player's own words: line breaks kept, nothing else. -->
  <p class="flex-1 text-sm wrap-break-word whitespace-pre-line">“{review.text}”</p>
</article>
