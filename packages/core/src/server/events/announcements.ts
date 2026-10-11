import { deliverAnnouncement } from '../notifications/audience';
import type { Handler, StoredEvent } from './types';

/**
 * Puts an admin's announcement in the bell of its audience. Runs after the response (or from the
 * sweeper), so a large audience never holds up the admin's request; idempotent through the unique
 * (event, recipient) index.
 */
export const announcementHandler: Handler = {
  name: 'system-announcements-v1',
  types: ['SystemAnnouncementSent'],
  async handle(event, db) {
    await deliverAnnouncement(
      db,
      event as Extract<StoredEvent, { type: 'SystemAnnouncementSent' }>,
    );
  },
};
