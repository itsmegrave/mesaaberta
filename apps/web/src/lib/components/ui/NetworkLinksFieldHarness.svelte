<script lang="ts">
  import NetworkLinksField from './NetworkLinksField.svelte';

  let {
    networks = [],
    urls = [],
    max = 3,
    reorder = false,
    errors = {},
  }: {
    networks?: string[];
    urls?: string[];
    max?: number;
    reorder?: boolean;
    errors?: { list?: string; rows?: { url?: string; network?: string }[] };
  } = $props();
</script>

<form>
  <NetworkLinksField
    bind:networks
    bind:urls
    items={[
      { name: 'Instagram', slug: 'instagram' },
      { name: 'Discord', slug: 'discord' },
    ]}
    {max}
    {reorder}
    idPrefix="test-link"
    legend="Redes"
    hint="Até três."
    error={errors.list}
    rowErrors={(index) => errors.rows?.[index] ?? {}}
    placeholder={(network) => (network === 'discord' ? 'https://discord.gg/…' : 'https://')}
    labels={{
      network: (n) => `Rede ${n}`,
      url: (n) => `Endereço ${n}`,
      remove: (n) => `Remover ${n}`,
      up: (n) => `Subir ${n}`,
      down: (n) => `Descer ${n}`,
      add: 'Adicionar',
      removed: () => 'Removido.',
      moved: (n, position) => `${n} para ${position}.`,
    }}
    inputClass="input"
    buttonClass="btn"
  />
</form>
