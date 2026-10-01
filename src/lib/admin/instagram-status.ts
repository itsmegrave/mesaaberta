import { m } from '$lib/paraglide/messages';
export function instagramStatus(status: string | null) {
  switch (status) {
    case 'queued':
      return m.instagram_status_queued();
    case 'processing':
      return m.instagram_status_processing();
    case 'publishing':
      return m.instagram_status_publishing();
    case 'uncertain':
      return m.instagram_status_uncertain();
    case 'failed':
      return m.instagram_status_failed();
    case 'skipped':
      return m.instagram_status_skipped();
    case 'published':
      return m.instagram_status_published();
    default:
      return m.instagram_status_none();
  }
}
