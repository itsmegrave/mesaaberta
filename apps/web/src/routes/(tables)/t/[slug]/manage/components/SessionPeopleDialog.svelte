<script lang="ts">
  // Gerenciar mesa → Sessões → "Quem joga", for a campanha aberta (`use_session_signup`): who plays
  // one session and who waits for it, in order, with "Tirar" (the first who waits takes the place)
  // and "Pôr na sessão"; then the rest of the roster, to put anyone in, a full session too.
  import PostButton from '#lib/components/PostButton.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import { sessionPlayerSchema } from '#lib/tables/confirmation.js';
  import { sessionDay, type SessionItem } from '#lib/tables/sessions.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let {
    session,
    roster,
    next,
    timezone,
    onclose,
  }: {
    session: SessionItem & { seats: NonNullable<SessionItem['seats']> };
    /** The players with a seat at the table. */
    roster: { playerId: string; username: string }[];
    next: string;
    timezone: string;
    onclose: () => void;
  } = $props();

  const locale = getLocale();
  const seats = $derived(session.seats);
  const people = $derived(seats.people ?? []);
  const others = $derived(
    roster.filter((player) => !people.some((person) => person.playerId === player.playerId)),
  );
  const row = 'flex min-h-14 items-center gap-3 border-b border-surface-200-800 py-2 last:border-0';
</script>

{#snippet post(action: string, playerId: string, label: string, primary: boolean)}
  <PostButton
    {action}
    fields={{ sessionId: session.id, playerId, next }}
    schema={sessionPlayerSchema}
    domain="table"
    errorMessage={() => m.manage_confirm_error()}
    success={action === '?/addToSession'
      ? m.toast_session_people_added()
      : m.toast_session_people_removed()}
    buttonClass="btn h-11 shrink-0 rounded-lg px-4 font-semibold {primary
      ? 'preset-filled-primary-500'
      : 'btn-secondary'}">{label}</PostButton
  >
{/snippet}

<DialogShell
  defaultOpen
  size="lg"
  scroll
  sheet
  onOpenChange={(open) => !open && onclose()}
  title={m.sessions_people_title({
    number: session.number,
    day: sessionDay(session.startsAt, timezone, locale),
  })}
  description={m.sessions_people_summary({
    going: seats.going,
    size: seats.size,
    roster: roster.length,
  })}
>
  <div class="mt-4 grid gap-4">
    {#if people.length > 0}
      <ul aria-label={m.sessions_people_open()}>
        {#each people as person (person.playerId)}
          <li class={row}>
            <span class="min-w-0 flex-1 truncate font-semibold">{atHandle(person.username)}</span>
            <span class="shrink-0 text-sm text-muted"
              >{person.status === 'going'
                ? m.sessions_people_going()
                : m.sessions_people_position({ position: person.position ?? 1 })}</span
            >
            {#if person.status === 'waiting'}
              {@render post('?/addToSession', person.playerId, m.sessions_people_add(), true)}
            {/if}
            {@render post(
              '?/removeFromSession',
              person.playerId,
              m.sessions_people_remove(),
              false,
            )}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-sm text-muted">{m.sessions_people_empty()}</p>
    {/if}

    {#if others.length > 0}
      <MAAccordion class="border-t border-surface-200-800">
        <MAAccordionItem value="roster" level={3} title={m.sessions_people_add_other()}>
          <ul aria-label={m.sessions_people_pick()}>
            {#each others as player (player.playerId)}
              <li class={row}>
                <span class="min-w-0 flex-1 truncate font-semibold"
                  >{atHandle(player.username)}</span
                >
                {@render post('?/addToSession', player.playerId, m.sessions_people_add(), false)}
              </li>
            {/each}
          </ul>
        </MAAccordionItem>
      </MAAccordion>
    {/if}
  </div>
</DialogShell>
