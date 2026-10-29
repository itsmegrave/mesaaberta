import type { Handle } from '@sveltejs/kit/hooks';
import { sendToApi } from './api-client';
import { releaseHref, releases } from '#lib/changelog.js';
import * as m from '#lib/paraglide/messages.js';

/** How often an isolate looks again when the newest day was not announced (flag off). */
const RECHECK_MS = 10 * 60 * 1000;
let checkedAt = 0;

/**
 * Puts the newest changelog day in everyone's bell, once, after the response. The first request of
 * an isolate (and then at most one every ten minutes) sends it to the api, which checks
 * `use_changelog_notices` and does nothing for a day that already went out, so a release needs no
 * extra step to notify.
 */
export const handleChangelogNotice: Handle = ({ event, resolve }) => {
  const latest = releases[0];
  const now = Date.now();

  if (latest && now - checkedAt > RECHECK_MS) {
    checkedAt = now;
    event.locals.afterResponse(async () => {
      const answer = await sendToApi(event.locals.env, '/v1/changelog/notice', null, {
        method: 'POST',
        json: {
          date: latest.date,
          title: m.changelog_notice_title({ title: latest.title }),
          summary: latest.summary,
          link: releaseHref(latest.date),
        },
      });
      // A refusal is the api's to explain in its own lines; this one says which status came back.
      if (answer && !answer.ok)
        event.locals.log.warn('changelog.notice_refused', {
          code: 'changelog_notice_refused',
          status: answer.status,
        });
    });
  }

  return resolve(event);
};
