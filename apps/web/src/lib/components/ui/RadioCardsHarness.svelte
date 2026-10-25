<script lang="ts">
  import RadioCards from './RadioCards.svelte';

  let { error }: { error?: string } = $props();
  let group = $state<'online' | 'in_person'>('online');
</script>

<form>
  <RadioCards
    name="modality"
    legend="Modalidade"
    options={[
      { value: 'online', label: 'Online', icon: 'globe' },
      { value: 'in_person', label: 'Presencial' },
    ]}
    bind:group
    {error}
  />
  <p data-testid="picked">{group}</p>
</form>
