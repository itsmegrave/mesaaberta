<script lang="ts">
  // An MAAccordion with two sections, the first open, for its spec.
  import MAAccordion, { type AccordionCollapse } from './MAAccordion.svelte';
  import MAAccordionItem from './MAAccordionItem.svelte';

  let { collapse }: { collapse?: AccordionCollapse } = $props();
  let open = $state(['present']);
</script>

<MAAccordion bind:value={open} {collapse}>
  <MAAccordionItem value="present" title="Quem compareceu?" summary="3 de 4 presentes">
    <p>Beatriz Nunes</p>
  </MAAccordionItem>
  <MAAccordionItem value="activity" title="Atividade recente" summary="Última há 2 horas" count={2}>
    <p>Lucas Ferreira pediu a vaga</p>
  </MAAccordionItem>
</MAAccordion>
<output data-testid="open">{open.join(',')}</output>
