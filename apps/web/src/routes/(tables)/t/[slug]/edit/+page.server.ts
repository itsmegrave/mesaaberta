import { openTablesEnabled } from '#lib/server/tables/open-enabled.js';
import { loadRead } from '#lib/server/reads/load.js';
import { contentRatingSymbolShown, tableSafetyEnabled } from '#lib/server/tables/safety-enabled.js';
import { error, redirect } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { NEW_TABLE_VALUES } from '#lib/tables/form-values.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { timezoneOf } from '#lib/server/time.js';
import { Forbidden, NotFound, TableConcluded } from '@mesaaberta/core/server/errors';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { handleTableForm } from '#lib/server/tables/form-action.js';
import { directoryEnabled } from '#lib/server/directories/flags.js';
import { readPlaceOptions, readTableForEdit } from '#lib/server/tables/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { locals, url, params, cookies } = event;
  const user = await requireUser(locals, url);

  try {
    const {
      slug,
      status,
      imagePath,
      catalog: _picked,
      seatsTaken,
      ...values
    } = await readTableForEdit(locals, user.id, params.slug, await timezoneOf(locals, cookies));
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
      openTables: await openTablesEnabled(locals),
      // The "Onde jogar" picker, while the places are on.
      places: (await directoryEnabled(locals, 'places'))
        ? await readPlaceOptions(locals, user.id)
        : null,
      safety: await tableSafetyEnabled(locals, await locals.getProfile()),
      ratingSymbol: await contentRatingSymbolShown(locals, await locals.getProfile()),
    };
  } catch (e) {
    // Someone else's table is a 403; one that is not there is a 404. A concluded one says why.
    if (e instanceof TableConcluded) error(403, { message: 'Forbidden', code: 'table_concluded' });
    if (e instanceof Forbidden) error(403, 'Forbidden');
    if (e instanceof NotFound) error(404, 'Not found');
    throw e;
  }
};

export const actions: Actions = {
  save: async (event) => {
    const { locals, params } = event;
    const user = await requireUser(locals, event.url);

    return handleTableForm(
      event,
      async (input, imagePath) => {
        const path = `/v1/table-writes/${encodeURIComponent(params.slug)}/update`;
        await writeViaApi(locals, user, path, { input, imagePath: imagePath ?? null });
        return { slug: params.slug };
      },
      undefined,
      // Back where the GM manages the table, which says it was saved.
      (slug) => `/t/${slug}/manage`,
    );
  },

  disable: async (event) => {
    const { locals, params, url } = event;
    const user = await requireUser(locals, url);

    try {
      await writeViaApi(
        locals,
        user,
        `/v1/table-writes/${encodeURIComponent(params.slug)}/disable`,
        {},
      );
    } catch (e) {
      if (e instanceof Forbidden) error(403, 'Forbidden');
      if (e instanceof NotFound) error(404, 'Not found');
      throw e;
    }

    redirect(303, '/tables');
  },
};
