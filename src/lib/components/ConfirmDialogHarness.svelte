<script lang="ts">
  // Opens a ConfirmDialog from a plain button, as a menu item would.
  import ConfirmDialog from './ConfirmDialog.svelte';

  let open = $state(false);
</script>

<button type="button" onclick={() => (open = true)}>Abrir</button>
<ConfirmDialog
  bind:open
  title="Remover Bruno?"
  text="Ele perde a vaga."
  label="Remover da mesa"
  action="?/remove"
  playerId="p1"
/>
