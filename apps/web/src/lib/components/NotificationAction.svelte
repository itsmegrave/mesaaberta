<script lang="ts">
  import type { Snippet } from 'svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import { notificationActionSchema } from '#lib/notifications/actions.js';

  import { m } from '#lib/paraglide/messages.js';

  type Props = {
    action: 'open' | 'read' | 'readAll';
    /** The notification; none for read all. */
    id?: string;
    /** Where to come back to: the page the form is on. */
    next: string;
    class?: string;
    buttonClass?: string;
    /** The button's content. */
    children: Snippet;
  };

  let { action, id, next, class: className = 'm-0', buttonClass = '', children }: Props = $props();
</script>

<!-- Each button owns its pending state; the feed and bell reload through the action redirect. -->
<PostButton
  action="/n?/{action}"
  fields={{ id, next }}
  schema={notificationActionSchema}
  errorMessage={m.error_generic_text}
  error={(errors) => (Object.keys(errors).length ? m.error_generic_text() : undefined)}
  class={className}
  {buttonClass}
  {children}
/>
