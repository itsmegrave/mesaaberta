<script lang="ts">
  import { outcomeLabel, type SessionItem } from '#lib/tables/sessions.js';
  import { m } from '#lib/paraglide/messages.js';

  // What became of a session that is behind ("Aconteceu", "Não aconteceu", "Cancelada") and, for a
  // player, whether they were there ("Você esteve", "Ausente").
  let { session }: { session: Pick<SessionItem, 'status' | 'attended'> } = $props();

  const chip =
    'inline-flex h-7 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap';
</script>

{#if session.status === 'cancelled'}
  <span class="{chip} border border-surface-200-800 text-muted">{outcomeLabel(session.status)}</span
  >
{:else if session.status !== 'scheduled'}
  <span class="{chip} bg-surface-wash">{outcomeLabel(session.status)}</span>
  {#if session.status === 'held' && session.attended === true}
    <span class="{chip} border border-primary-500 bg-surface-wash"
      >{m.sessions_you_were_there()}</span
    >
  {:else if session.status === 'held' && session.attended === false}
    <span class="{chip} bg-lamp-wash">{m.sessions_you_were_absent()}</span>
  {/if}
{/if}
