<script lang="ts">
  // A DetailList with two facts, for its spec.
  import DetailList, { type DetailLayout } from './DetailList.svelte';
  import DetailRow from './DetailRow.svelte';

  let { layout }: { layout?: DetailLayout } = $props();
</script>

<DetailList {layout}>
  <DetailRow label="Nome">Ana</DetailRow>
  <DetailRow label="ID" class="font-mono">abc-123</DetailRow>
</DetailList>
