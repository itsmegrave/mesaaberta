<script lang="ts">
  // A list's dialog as the admin pages mount it: the row lives in a `Target`, and the dialog's words
  // come from a preset that reads the row, so closing the dialog clears the row they are made from.
  import { z } from 'zod';
  import { Target } from '#lib/target.svelte.js';
  import ModerationDialog from './ModerationDialog.svelte';

  type Row = { id: string; name: string };
  const removing = new Target<Row>();
  const words = (name: string) => ({
    label: 'Rejeitar lugar',
    title: `Rejeitar “${name}”?`,
    text: 'O lugar não entra em Onde jogar.',
    confirm: 'Rejeitar',
    success: 'Lugar rejeitado.',
  });
</script>

<button type="button" onclick={() => (removing.current = { id: 'p1', name: 'Taverna' })}
  >Abrir</button
>
{#if removing.current}
  {@const row = removing.current}
  {#key row.id}
    <ModerationDialog
      bind:open={removing.open}
      trigger={false}
      action="?/remove"
      schema={z.object({ id: z.string() })}
      fields={{ id: row.id }}
      {...words(row.name)}
    />
  {/key}
{/if}
