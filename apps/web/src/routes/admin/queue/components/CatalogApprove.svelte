<script lang="ts">
  import { entrySchema, type CatalogKind } from '@mesaaberta/core/admin/catalog';
  import PostButton from '#lib/components/PostButton.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    kind,
    id,
    name,
    class: className,
  }: { kind: CatalogKind; id: string; name: string; class: string } = $props();
</script>

<PostButton
  action="?/approve"
  fields={{ kind, id }}
  schema={entrySchema}
  domain="catalog"
  errorMessage={m.admin_dialog_error}
  success={m.admin_toast_approve()}
  error={(errors) => (errors._errors?.[0] || errors.id?.[0] ? m.admin_dialog_error() : undefined)}
  buttonClass={className}
  ><span aria-hidden="true">{m.admin_queue_approve()}</span>
  <span class="sr-only">{m.admin_queue_approve()}: {name}</span></PostButton
>
