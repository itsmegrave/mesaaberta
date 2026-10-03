import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { toast } from '$lib/toaster';
import { m } from '$lib/paraglide/messages';
import { instagramFeedback } from './instagram-feedback';

/**
 * Generates and publishes a table's post from the admin's list: the page's own `?/publish` action,
 * the same one a native form would post, answered in a toast. The list reloads to show the new state.
 */
export async function publishTable(tableId: string) {
  const body = new FormData();
  body.set('tableId', tableId);
  try {
    const response = await fetch('?/publish', {
      method: 'POST',
      body,
      headers: { 'x-sveltekit-action': 'true', accept: 'application/json' },
    });
    instagramFeedback(deserialize(await response.text()));
    await invalidateAll();
  } catch {
    toast.error(m.admin_dialog_error());
  }
}
