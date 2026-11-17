<script lang="ts">
  // "Quando posso jogar" as lines ("Noite: seg, qua, sex") beside a clock. Draws only what it is
  // given; no lines draws nothing.
  import Icon from '#lib/components/ui/Icon.svelte';

  let {
    lines,
    label,
    class: className = '',
  }: {
    lines: string[];
    /** The list's name for screen readers ("Quando pode jogar"). */
    label: string;
    class?: string;
  } = $props();
</script>

{#if lines.length > 0}
  <div class="flex items-start gap-2 text-sm {className}">
    <Icon name="clock" size={16} class="mt-0.5 shrink-0 text-muted" />
    <ul aria-label={label} class="grid gap-0.5">
      {#each lines as line (line)}
        <li>{line}</li>
      {/each}
    </ul>
  </div>
{/if}
