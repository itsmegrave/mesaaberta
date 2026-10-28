import type { ActionResult } from '$app/forms';
import { toast } from '#lib/toaster.js';
import { m } from '#lib/paraglide/messages.js';
/** The publish action's answer as a toast; `network` is the connector's name ("Instagram"). */
export function postFeedback(result: ActionResult, network: string) {
  const data = result.type === 'success' || result.type === 'failure' ? result.data : undefined;
  if (result.type === 'error' || result.type === 'failure' || data?.publishError)
    return toast.error(m.post_publish_error());
  switch (data?.publishResult) {
    case 'queued':
      return toast.info(m.post_queued());
    case 'published':
      return toast.success(m.post_published({ network }));
    case 'processing':
      return toast.info(m.post_processing({ network }));
    case 'unavailable':
      return toast.error(m.post_unavailable({ network }));
    case 'not-eligible':
      return toast.error(m.post_not_eligible());
    case 'already-published':
      return toast.info(m.post_already_published());
    case 'uncertain':
      return toast.warning(m.post_uncertain({ network }));
  }
}
