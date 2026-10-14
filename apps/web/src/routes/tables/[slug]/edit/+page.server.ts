import { loadRead } from '$lib/server/reads/load';
import { error, redirect } from '@sveltejs/kit';
import { initialForm } from '$lib/forms/contract';
import { NEW_TABLE_VALUES } from '$lib/tables/form-values';
import { requireUser } from '$lib/server/auth/guard';
import { writeViaApi } from '$lib/server/api-write';
import { timezoneOf } from '$lib/server/time';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { handleTableForm } from '$lib/server/tables/form-action';
import { disableTable, loadTableForEdit, updateTable } from '@mesaaberta/core/server/tables/write';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { locals, url, params, cookies } = event;
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  try {
    const profile = await locals.getProfile();
    const {
      slug,
      status,
      imagePath,
      catalog: _picked,
      seatsTaken,
      ...values
    } = await loadTableForEdit(locals.db, profile, params.slug, await timezoneOf(locals, cookies));
    const catalogRead = await loadRead(event, 'editCatalog');

    return {
      slug,
      status,
      // The saved title, for the breadcrumb: the form's own may be mid-edit.
      title: values.title,
      form: initialForm({ ...NEW_TABLE_VALUES, ...values }),
      imageUrl: imageUrl(supabaseUrlOf(locals.env), imagePath),
      systems: catalogRead.systems,
      catalog: catalogRead.catalog,
      catalogRead,
      seatsTaken,
    };
  } catch (e) {
    // Someone else's table is a 403; one that is not there is a 404.
    if (e instanceof Forbidden) error(403, 'Forbidden');
    if (e instanceof NotFound) error(404, 'Not found');
    throw e;
  }
};

export const actions: Actions = {
  save: async (event) => {
    const { locals, params } = event;
    await requireUser(locals, event.url);
    if (!locals.db) error(503, 'Database not configured');
    const db = locals.db;

    return handleTableForm(
      event,
      async (input, imagePath) => {
        const profile = await locals.getProfile();
        const path = `/v1/table-writes/${encodeURIComponent(params.slug)}/update`;
        const remote = profile
          ? await writeViaApi(locals, 'api_table_write', profile, path, {
              input,
              imagePath: imagePath ?? null,
            })
          : null;
        const eventIds = remote
          ? remote.eventIds
          : [(await updateTable(db, profile, params.slug, input, { imagePath })).eventId].filter(
              (id): id is string => id !== null,
            );
        // Nothing players see changed: no invite, no notification.
        for (const eventId of eventIds) {
          locals.afterResponse((db) =>
            dispatchEvent(db, handlersFor(event.locals.env), eventId, new Date(), locals.log),
          );
        }
        return { slug: params.slug };
      },
      undefined,
      // Back where the GM manages the table, which says it was saved.
      (slug) => `/tables/${slug}/manage`,
    );
  },

  disable: async (event) => {
    const { locals, params, url } = event;
    await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    try {
      const profile = await locals.getProfile();
      const remote = profile
        ? await writeViaApi(
            locals,
            'api_table_write',
            profile,
            `/v1/table-writes/${encodeURIComponent(params.slug)}/disable`,
            {},
          )
        : null;
      const eventIds = remote
        ? remote.eventIds
        : [(await disableTable(locals.db, profile, params.slug)).eventId];
      for (const eventId of eventIds)
        locals.afterResponse((db) =>
          dispatchEvent(db, handlersFor(event.locals.env), eventId, new Date(), locals.log),
        );
    } catch (e) {
      if (e instanceof Forbidden) error(403, 'Forbidden');
      if (e instanceof NotFound) error(404, 'Not found');
      throw e;
    }

    redirect(303, '/tables');
  },
};
