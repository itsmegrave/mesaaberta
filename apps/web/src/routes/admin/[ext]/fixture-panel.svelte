<script lang="ts">
  let { data }: { data: { label: string } } = $props();
</script>

<section aria-label={data.label}>{data.label}</section>
