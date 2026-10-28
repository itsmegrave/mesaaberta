import { deserialize } from '$app/forms';
import { refreshAll } from '$app/navigation';
import { toast } from '#lib/toaster.js';
import { m } from '#lib/paraglide/messages.js';
import { postFeedback } from './post-feedback';

/**
 * Generates and publishes a table's post from the admin's list: the page's own `?/publish` action,
 * the same one a native form would post, answered in a toast. The list reloads to show the new state.
 */
export async function publishTable(tableId: string, network: string) {
  const body = new FormData();
  body.set('tableId', tableId);
  try {
    const response = await fetch('?/publish', {
      method: 'POST',
      body,
      headers: { 'x-sveltekit-action': 'true', accept: 'application/json' },
    });
    postFeedback(deserialize(await response.text()), network);
    await refreshAll();
  } catch {
    toast.error(m.admin_dialog_error());
  }
}
