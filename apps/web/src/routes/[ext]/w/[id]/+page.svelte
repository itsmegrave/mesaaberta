<script lang="ts">
  import { page } from '$app/state';

  let { data } = $props();
  // An answer replaces it until the next load.
  let widget = $derived(data.widget);
</script>

<!-- The widget fills the page itself, title included: only its kind knows what it shows. -->
<data.Widget
  {widget}
  mode="page"
  action="/{data.ext}/w/{widget.id}?/respond"
  next={page.url.pathname}
  onAnswer={(next) => {
    if (next) widget = next;
  }}
/>
