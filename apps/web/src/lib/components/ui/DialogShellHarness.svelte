<script lang="ts">
  import DialogActions from './DialogActions.svelte';
  import DialogShell from './DialogShell.svelte';

  let {
    role = 'dialog',
    lazy = true,
    focusCancel = false,
    onconfirm,
  }: {
    role?: 'dialog' | 'alertdialog';
    lazy?: boolean;
    focusCancel?: boolean;
    onconfirm?: () => void;
  } = $props();

  let open = $state(false);
  const cancel = () => document.querySelector<HTMLElement>('[data-harness-cancel]');
</script>

<p data-testid="state">{open ? 'open' : 'closed'}</p>
<DialogShell
  bind:open
  {role}
  {lazy}
  initialFocusEl={focusCancel ? cancel : undefined}
  title="Remover Bruno?"
  description="Ele perde a vaga."
>
  {#snippet trigger()}Abrir{/snippet}
  <DialogActions
    cancel="Cancelar"
    cancelAttributes={{ 'data-harness-cancel': '' }}
    tone="danger"
    confirm="Remover"
    onconfirm={() => {
      onconfirm?.();
      open = false;
    }}
  />
</DialogShell>
