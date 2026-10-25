<script lang="ts">
  // A field's error line, for a control that draws its own label and so cannot sit in FormField
  // (SearchSelect, DateTimeField, SeatSlider, a radio group). The id is `<field>-error`: the control
  // points at it with aria-describedby and ErrorSummary moves the focus to the field by it.
  let {
    id,
    message,
    class: className = 'mt-1',
  }: { id: string; message?: string; class?: string } = $props();
</script>

{#if message}
  <p id="{id}-error" role="alert" class="text-sm font-semibold text-error-700-300 {className}">
    {message}
  </p>
{/if}
