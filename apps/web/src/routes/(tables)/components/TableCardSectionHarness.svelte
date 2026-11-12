<script lang="ts">
  // TableCardSection inside its accordion, for its spec.
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import TableCardSection from './TableCardSection.svelte';

  let { count }: { count: number } = $props();
  let open = $state(['soon']);
  const tables = $derived(
    Array.from({ length: count }, (_, i) => ({
      slug: `mesa-${i + 1}`,
      title: `Mesa ${i + 1}`,
      kind: 'one_shot' as const,
      system: { name: 'Daggerheart' },
      gmName: 'ana',
      seatsLeft: 3,
      capacity: 5,
      timezone: 'America/Sao_Paulo',
      startsAt: new Date('2026-10-10T22:00:00Z'),
    })),
  );
</script>

<MAAccordion bind:value={open}>
  <TableCardSection value="soon" title="Começa já" summary="Nas próximas 6 horas" {tables} />
</MAAccordion>
