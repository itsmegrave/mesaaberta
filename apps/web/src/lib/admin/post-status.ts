import { m } from '#lib/paraglide/messages.js';
export function postStatus(status: string | null) {
  switch (status) {
    case 'queued':
      return m.post_status_queued();
    case 'processing':
      return m.post_status_processing();
    case 'publishing':
      return m.post_status_publishing();
    case 'uncertain':
      return m.post_status_uncertain();
    case 'failed':
      return m.post_status_failed();
    case 'skipped':
      return m.post_status_skipped();
    case 'published':
      return m.post_status_published();
    default:
      return m.post_status_none();
  }
}
