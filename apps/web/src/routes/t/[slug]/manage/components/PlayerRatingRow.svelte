<script lang="ts">
  // One person quem mestra marked present: five stars and "Enviar nota", with an optional note only
  // the GM sees. Once sent the stars stay, read-only: a rating is final.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import StarRating from '#lib/components/ui/StarRating.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import { registrationError } from '#lib/tables/registration-errors.js';
  import { playerRatingFormSchema } from '#lib/tables/registration.js';
  import { MAX_COMMENT_LENGTH } from '@mesaaberta/core/tables/rating';

  let {
    next,
    player,
  }: {
    next: string;
    player: {
      playerId: string;
      username: string;
      avatarUrl: string | null;
      /** The score already given at this table, or null. */
      playerRating: number | null;
    };
  } = $props();

  let commenting = $state(false);
  const commentId = $derived(`player-rating-comment-${player.playerId}`);

  // svelte-ignore state_referenced_locally
  const rating = actionForm({
    initial: { playerId: player.playerId, score: 0, comment: '', next },
    schema: playerRatingFormSchema,
    domain: 'table',
    errorMessage: () => m.player_rating_pick(),
    onSuccess: () => toast.success(m.toast_player_rated()),
    onFailure(updated) {
      const code = updated?.message?.code;
      if (!code) return;
      toast.error(code === 'already_rated' ? m.player_rating_already() : registrationError(code));
    },
  });
</script>

<li class="flex flex-col gap-3 border-t border-surface-200-800 py-4 first:border-t-0">
  {#if player.playerRating !== null}
    <div class="flex flex-wrap items-center gap-3">
      <MAAvatar src={player.avatarUrl} name={player.username} size={36} />
      <span class="min-w-0 flex-1 truncate font-semibold">{player.username}</span>
      <StarRating
        name="score-{player.playerId}"
        label={m.player_rating_for({ name: player.username })}
        value={player.playerRating}
        hideLabel
        readOnly
      />
      <span class="text-sm font-semibold text-muted">{m.player_rating_sent()}</span>
    </div>
  {:else}
    <MAForm action="?/ratePlayer" onsubmit={rating.submit} class="flex flex-col gap-3">
      <input type="hidden" name="playerId" value={player.playerId} />
      <input type="hidden" name="next" value={next} />
      <div class="flex flex-wrap items-center gap-3">
        <MAAvatar src={player.avatarUrl} name={player.username} size={36} />
        <span class="min-w-0 flex-1 truncate font-semibold">{player.username}</span>
        <StarRating
          name="score"
          label={m.player_rating_for({ name: player.username })}
          value={Number(rating.values.score)}
          invalid={!!rating.errors.score}
          hideLabel
          onchange={(score) => rating.change('score', score)}
        />
        <MAButton type="submit" variant="primary" controller={rating} class="font-semibold"
          ><span class="sm:hidden">{m.player_rating_submit_short()}</span><span
            class="hidden sm:inline">{m.player_rating_submit()}</span
          ></MAButton
        >
      </div>
      {#if commenting}
        <div>
          <label for={commentId} class="label-text block font-semibold"
            >{m.player_rating_comment()}
            <span class="font-normal text-muted">{m.player_rating_comment_hint()}</span></label
          >
          <MATextArea
            id={commentId}
            name="comment"
            rows={3}
            maxlength={MAX_COMMENT_LENGTH}
            bind:value={() => rating.values.comment, (value) => rating.change('comment', value)}
            class="mt-1 textarea"
          />
        </div>
      {:else}
        <button
          type="button"
          class="self-start text-sm link-underline font-semibold"
          onclick={() => (commenting = true)}>{m.player_rating_add_comment()}</button
        >
      {/if}
      {#if rating.errors.score}
        <p role="alert" class="text-sm font-semibold text-error-700-300">
          {m.player_rating_pick()}
        </p>
      {/if}
    </MAForm>
  {/if}
</li>
