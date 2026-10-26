<script lang="ts">
  // A campaign or adventure that goes on: the GM lets players rate before it ends, or ends it.
  // Each player rates once, however many sessions the table has.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import ConfirmAction from '#lib/components/ConfirmAction.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import { getLocale } from '#lib/paraglide/runtime.js';
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

  const day = new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'long' });
  const letOn = (at: Date | string | null) => day.format(new Date(at ?? 0));
  let picked = $state(0);

  // Only the ones marked present at a session, and not the ones already let.
  const eligible = $derived(
    players.filter((player) => player.attended === true && !player.ratingOpenedAt),
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
  class="mt-8 rounded-lg border border-surface-200-800 bg-surface-50-950 p-5 md:p-6"
>
  <div class="flex flex-wrap items-center gap-3">
    <h2 id="going-on" class="text-xl font-semibold">{m.manage_going_title()}</h2>
    <StatusBadge status="table:going_on" />
  </div>
  <p class="mt-2 text-surface-700-300">{m.manage_going_text()}</p>

  <!-- On a phone the list folds under its header; on a wide screen it stays open. -->
  <MAAccordion collapse="phone" class="mt-4 border-y border-surface-200-800 md:mt-5 md:border-0">
    <MAAccordionItem
      value="release"
      level={3}
      title={m.manage_going_rate_title()}
      summary={m.manage_going_rate_summary({ count: eligible.length })}
      count={eligible.length}
      titleClass="font-semibold"
    >
      <MAForm action="?/allowRatings" onsubmit={allow.submit}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="attendance" value="1" />
        <fieldset class="min-w-0">
          <legend class="sr-only">{m.manage_going_rate_title()}</legend>
          <p class="text-sm text-muted">{m.manage_going_rate_hint()}</p>
          <ul class="mt-3 flex flex-col gap-2">
            {#each eligible as player (player.playerId)}
              <li>
                <label
                  class="flex min-h-16 items-center gap-3 rounded-lg border border-surface-200-800 px-3 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10"
                >
                  <input
                    type="checkbox"
                    name="present"
                    value={player.playerId}
                    class="checkbox"
                    onchange={(event) => (picked += event.currentTarget.checked ? 1 : -1)}
                  />
                  <MAAvatar src={player.avatarUrl} name={player.username} size={32} />
                  <span class="min-w-0 truncate">{player.username}</span>
                </label>
              </li>
            {/each}
            {#each letAlready as player (player.playerId)}
              <li
                class="flex min-h-16 items-center gap-3 rounded-lg border border-surface-200-800 px-3"
              >
                <Icon name="check" size={20} class="shrink-0 text-success-500" />
                <MAAvatar src={player.avatarUrl} name={player.username} size={32} />
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-semibold">{player.username}</span>
                  <span class="text-sm text-muted"
                    >{m.manage_going_rated_on({ date: letOn(player.ratingOpenedAt) })}</span
                  >
                </span>
              </li>
            {/each}
          </ul>
          {#if eligible.length === 0}
            <p class="mt-3 text-sm text-muted">{m.manage_going_rate_none()}</p>
          {/if}
        </fieldset>
        {#if eligible.length > 0}
          <MAButton type="submit" variant="primary" controller={allow} class="mt-4 font-semibold"
            >{picked > 0
              ? m.manage_going_rate_submit_count({ count: picked })
              : m.manage_going_rate_submit()}</MAButton
          >
        {/if}
        {#if allow.errors._errors?.[0]}
          <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
            {allow.errors._errors[0]}
          </p>
        {/if}
      </MAForm>
    </MAAccordionItem>
  </MAAccordion>

  <div class="mt-6 border-t border-surface-200-800 pt-5">
    <p class="text-sm text-muted">{m.manage_going_finish_lead()}</p>
    <ConfirmAction
      action="{tableManage}?/finish"
      success={m.toast_table_finished()}
      {next}
      label={m.manage_going_finish()}
      title={m.manage_going_finish_title()}
      text={m.manage_going_finish_text()}
      class="{buttonClass('danger')} mt-3 font-semibold"
    />
  </div>
</section>
