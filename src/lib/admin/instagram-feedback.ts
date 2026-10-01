import type { ActionResult } from '@sveltejs/kit';
import { toast } from '$lib/toaster';
import { m } from '$lib/paraglide/messages';
export function instagramFeedback(result: ActionResult) {
  const data = result.type === 'success' || result.type === 'failure' ? result.data : undefined;
  if (data?.invalid) return toast.error(m.instagram_reconcile_invalid());
  if (result.type === 'error' || result.type === 'failure' || data?.publishError)
    return toast.error(m.instagram_publish_error());
  switch (data?.publishResult) {
    case 'published':
      return toast.success(m.instagram_published());
    case 'processing':
      return toast.info(m.instagram_processing());
    case 'unavailable':
      return toast.error(m.instagram_unavailable());
    case 'not-eligible':
      return toast.error(m.instagram_not_eligible());
    case 'already-published':
      return toast.info(m.instagram_already_published());
    case 'uncertain':
      return toast.warning(m.instagram_reconcile_hint());
  }
  if (data?.reconciled) toast.success(m.instagram_reconciled());
}
