import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';

/** Same-origin SvelteKit action transport; the caller decides how to display/apply its result. */
export async function postAction(action: string, data: FormData): Promise<ActionResult> {
  const url = new URL(action, window.location.href);
  if (url.origin !== window.location.origin) throw new Error('Expected a same-origin action');
  const response = await fetch(action, {
    method: 'POST',
    body: data,
    credentials: 'same-origin',
    headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
  });
  return deserialize(await response.text());
}
