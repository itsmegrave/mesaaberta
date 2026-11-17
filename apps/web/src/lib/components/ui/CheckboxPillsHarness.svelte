<script lang="ts">
  import CheckboxPills from './CheckboxPills.svelte';

  let { error }: { error?: string } = $props();
  let group = $state<('shop' | 'podcast' | 'event')[]>(['shop']);
</script>

<form>
  <CheckboxPills
    name="types"
    legend="Tipo"
    hint="Escolha de 1 a 3."
    options={[
      { value: 'shop', label: 'Loja' },
      { value: 'podcast', label: 'Podcast' },
      { value: 'event', label: 'Evento ou convenção' },
    ]}
    bind:group
    {error}
  />
  <p data-testid="picked">{group.join(',')}</p>
</form>
