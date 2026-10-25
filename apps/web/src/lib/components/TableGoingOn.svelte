<script lang="ts">
  // A campaign or adventure that goes on: the GM lets players rate before it ends, or ends it.
  // Each player rates once, however many sessions the table has.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import Form from '#lib/components/Form.svelte';
  import Button, { buttonClass } from '#lib/components/Button.svelte';
  import ConfirmAction from '#lib/components/ConfirmAction.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import { answerSchema } from '#lib/tables/confirmation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  let {
    next,
    tableManage,
    players,
  }: {
    next: string;
    /** The manage page, where the actions live. */
    tableManage: string;
    players: {
      playerId: string;
      username: string;
      avatarUrl: string | null;
      attended: boolean | null;
      ratingOpenedAt: Date | string | null;
    }[];
  } = $props();

  // Not the ones marked absent, nor the ones already let.
  const eligible = $derived(
    players.filter((player) => player.attended !== false && !player.ratingOpenedAt),
  );
  const letAlready = $derived(players.filter((player) => player.ratingOpenedAt));

  // svelte-ignore state_referenced_locally
  const allow = actionForm({
    initial: { next },
    schema: answerSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.manage_going_rate_done()),
  });
</script>

<section
  aria-labelledby="going-on"
  class="mt-8 rounded-lg border-2 border-surface-200-800 bg-panel p-5 md:p-6"
>
  <h2 id="going-on" class="text-xl font-semibold">{m.manage_going_title()}</h2>
  <p class="mt-2 text-surface-700-300">{m.manage_going_text()}</p>

  <Form action="?/allowRatings" onsubmit={allow.submit} class="mt-5">
    <input type="hidden" name="next" value={next} />
    <input type="hidden" name="attendance" value="1" />
    <fieldset class="min-w-0">
      <legend class="font-semibold">{m.manage_going_rate_title()}</legend>
      <p class="mt-1 text-sm text-muted">{m.manage_going_rate_hint()}</p>
      {#if eligible.length === 0}
        <p class="mt-3 text-sm text-muted">{m.manage_going_rate_none()}</p>
      {:else}
        <ul class="mt-3 flex flex-col gap-2">
          {#each eligible as player (player.playerId)}
            <li>
              <label class="flex items-center gap-3 font-semibold">
                <input type="checkbox" name="present" value={player.playerId} class="checkbox" />
                <Avatar src={player.avatarUrl} name={player.username} size={32} />
                <span class="min-w-0 truncate">{player.username}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/if}
      {#if letAlready.length > 0}
        <p class="mt-3 text-sm text-muted">
          {m.manage_going_rated_already()}: {letAlready.map((player) => player.username).join(', ')}
        </p>
      {/if}
    </fieldset>
    {#if eligible.length > 0}
      <Button type="submit" variant="primary" controller={allow} class="mt-4 font-semibold"
        >{m.manage_going_rate_submit()}</Button
      >
    {/if}
    {#if allow.errors._errors?.[0]}
      <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
        {allow.errors._errors[0]}
      </p>
    {/if}
  </Form>

  <div class="mt-6 border-t border-surface-200-800 pt-5">
    <ConfirmAction
      action="{tableManage}?/finish"
      success={m.toast_table_finished()}
      {next}
      label={m.manage_going_finish()}
      title={m.manage_going_finish_title()}
      text={m.manage_going_finish_text()}
      class="{buttonClass('secondary')} font-semibold"
    />
  </div>
</section>
