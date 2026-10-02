<script lang="ts">
  import Form from '$lib/components/Form.svelte';
  import type { Snippet } from 'svelte';
  import { deserialize, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { createMutation } from '@tanstack/svelte-query';
  import type { ActionResult } from '@sveltejs/kit';
  import { queryClient } from '$lib/query/context';
  import { toast } from '$lib/toaster';
  import { m } from '$lib/paraglide/messages';

  let {
    action,
    children,
    onresult,
    onbusy,
  }: {
    action: string;
    children: Snippet<[boolean]>;
    onresult: (result: ActionResult) => void;
    onbusy?: (busy: boolean) => void;
  } = $props();
  const client = queryClient();
  const mutation = createMutation(
    () => ({
      mutationFn: async (body: FormData) => {
        const response = await fetch(action, {
          method: 'POST',
          body,
          headers: { 'x-sveltekit-action': 'true', accept: 'application/json' },
        });
        return deserialize(await response.text());
      },
      onSuccess: async (result) => {
        if (result.type === 'redirect') await applyAction(result);
        else {
          onresult(result);
          await invalidateAll();
        }
      },
      onError: () => toast.error(m.admin_dialog_error()),
      onSettled: () => onbusy?.(false),
    }),
    () => client,
  );
</script>

<Form
  method="POST"
  {action}
  aria-busy={mutation.isPending}
  onsubmit={(event) => {
    event.preventDefault();
    if (mutation.isPending) return;
    onbusy?.(true);
    mutation.mutate(new FormData(event.currentTarget));
  }}
>
  {@render children(mutation.isPending)}
</Form>
