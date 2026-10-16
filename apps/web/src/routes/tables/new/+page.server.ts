import { loadRead } from '#lib/server/reads/load.js';
import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { timezoneOf } from '#lib/server/time.js';
import { handleTableForm } from '#lib/server/tables/form-action.js';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { createTable } from '@mesaaberta/core/server/tables/write';
import {
  TABLE_CREATION_LIMIT,
  TABLE_DRAFT_LIMIT,
  checkRateLimit,
} from '@mesaaberta/core/server/rate-limit';
import { NEW_TABLE_VALUES } from '#lib/tables/form-values.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { locals, url, cookies } = event;
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  locals.track('gm_onboarding_started', user.id, {
    gm_user_id: user.id,
    onboarding_step: 'table_setup_start',
    country_market: 'BR',
  });

  // The GM's own pending suggestions are offered too.
  const catalogRead = await loadRead(event, 'catalog');

  return {
    form: initialForm({ ...NEW_TABLE_VALUES, timezone: await timezoneOf(locals, cookies) }),
    systems: catalogRead.systems,
    catalog: catalogRead.catalog,
    catalogRead,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const { locals } = event;
    // Who is asking comes before whether we can serve them.
    await requireUser(locals, event.url);
    if (!locals.db) error(503, 'Database not configured');
    const db = locals.db;

    return handleTableForm(
      event,
      async (input, imagePath, draft) => {
        const profile = await locals.getProfile();
        // Through the api Worker when `api_table_write` is on for this person; here otherwise.
        const remote = profile
          ? await writeViaApi(locals, 'api_table_write', profile, '/v1/table-writes', {
              input,
              imagePath: imagePath ?? null,
              draft,
            })
          : null;
        const created = remote
          ? {
              slug: String(remote.body.slug),
              draft: remote.body.draft === true,
              eventId: remote.eventIds[0],
            }
          : await createTable(db, profile, input, { imagePath, draft });
        // After the commit and the response, so the visitor never waits for a handler.
        locals.afterResponse((db) =>
          dispatchEvent(db, handlersFor(event.locals.env), created.eventId, new Date(), locals.log),
        );
        return created;
      },
      // A limited person is told before their image is stored. `createTable` checks again, under a lock.
      async (draft) => {
        const actor = await locals.getProfile();
        if (actor)
          await checkRateLimit(db, actor.id, draft ? TABLE_DRAFT_LIMIT : TABLE_CREATION_LIMIT);
      },
      // A draft goes to where its GM manages it, which says it is not public yet.
      (slug, draft) => (draft ? `/tables/${slug}/manage` : `/tables/${slug}`),
    );
  },
};
