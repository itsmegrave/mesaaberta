import type { Handle } from '@sveltejs/kit';
import { announceChangelogDay } from '@mesaaberta/core/server/notifications/changelog';
import { releaseHref, releases } from '#lib/changelog.js';
import * as m from '#lib/paraglide/messages.js';

/** How often an isolate looks again when the newest day was not announced (flag off). */
const RECHECK_MS = 10 * 60 * 1000;
let checkedAt = 0;

/**
 * Puts the newest changelog day in everyone's bell, once, after the response. The first request of
 * an isolate (and then at most one every ten minutes) asks `announceChangelogDay`, which does
 * nothing for a day that already went out, so a release needs no extra step to notify.
 */
export const handleChangelogNotice: Handle = ({ event, resolve }) => {
  const latest = releases[0];
  const now = Date.now();

  if (latest && now - checkedAt > RECHECK_MS) {
    checkedAt = now;
    event.locals.afterResponse(async (db) => {
      if (!(await event.locals.flags.isEnabled('use_changelog_notices'))) return;
      await announceChangelogDay(db, {
        date: latest.date,
        title: m.changelog_notice_title({ title: latest.title }),
        summary: latest.summary,
        link: releaseHref(latest.date),
      });
    });
  }

  return resolve(event);
};
