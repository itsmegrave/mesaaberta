<script lang="ts">
  import { page } from '$app/state';
  import { widgets } from '#lib/extensions/panels.js';

  let { data } = $props();
  // An answer replaces it until the next load.
  let widget = $derived(data.widget);
</script>

<!-- The widget fills the page itself, title included: only its kind knows what it shows. -->
{#await widgets[data.widget.kind]() then { default: Widget }}
  {#if widget}
    <Widget
      {widget}
      mode="page"
      action="/{data.ext}/w/{widget.id}?/respond"
      next={page.url.pathname}
      onAnswer={(next) => {
        if (next) widget = next;
      }}
    />
  {/if}
{/await}
