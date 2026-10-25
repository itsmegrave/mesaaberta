<script lang="ts">
  import type { WidgetProps } from '#lib/extensions/panels.js';

  let { widget, action, next, mode, onAnswer }: WidgetProps = $props();
</script>

<section
  aria-label={String(widget.data.question)}
  data-mode={mode}
  data-action={action}
  data-next={next}
>
  <button type="button" onclick={() => onAnswer({ ...widget, data: { question: 'Valeu!' } })}
    >Votar</button
  >
  <button type="button" onclick={() => onAnswer(null)}>Agora não</button>
</section>
