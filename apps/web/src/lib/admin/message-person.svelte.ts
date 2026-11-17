import { goto } from '$app/navigation';
import { page } from '$app/state';
import { createMutation } from '@tanstack/svelte-query';
import type { KebabItem } from '#lib/components/ui/KebabMenu.svelte';
import { postAction } from '#lib/forms/action.js';
import { m } from '#lib/paraglide/messages.js';
import { queryClient } from '#lib/query/context.js';
import { toast } from '#lib/toaster.js';

/** The person's admin page posts the conversation open (the same action as its own button). */
export const messageAction = (profileId: string) => `/admin/users/${profileId}?/message`;

/**
 * "Mandar mensagem" from an admin list: opens the admin conversation ("[Admin] @username") with
 * the person behind a row (the owner of what waits for review, or the person themselves) and goes
 * to it. Offered while
 * `use_admin_messages` is on (the admin layout's `adminMessages`), never to oneself or to a row
 * whose account is gone. Call it while the component initialises.
 */
export function personMessages() {
  const client = queryClient();
  const mutation = createMutation(
    () => ({
      mutationFn: (profileId: string) => postAction(messageAction(profileId), new FormData()),
      retry: false,
    }),
    () => client,
  );

  let opening = $state<string | null>(null);

  async function open(profileId: string) {
    if (mutation.isPending) return;
    opening = profileId;
    try {
      const result = await mutation.mutateAsync(profileId);
      if (result.type === 'redirect') return void (await goto(result.location));
      // The account is gone or no longer active, or the api failed.
      toast.error(m.admin_message_failed());
    } catch {
      toast.error(m.admin_message_failed());
    } finally {
      opening = null;
    }
  }

  /** Whether a row may offer it: the flag is on, and the row names someone other than the admin. */
  const can = (profileId: string | null | undefined): profileId is string =>
    Boolean(profileId) && page.data.adminMessages === true && profileId !== page.data.adminId;

  return {
    can,
    open,
    /** The person whose conversation is being opened, for a button's busy state. */
    get opening() {
      return opening;
    },
    /** The row menu's item, or none. */
    item(profileId: string | null | undefined): KebabItem[] {
      return can(profileId)
        ? [
            {
              id: 'message',
              label: m.admin_user_message(),
              icon: 'game-icons:scroll-quill',
              disabled: mutation.isPending,
              onselect: () => void open(profileId),
            },
          ]
        : [];
    },
  };
}
