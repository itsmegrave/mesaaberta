import { reportPlaceSchema } from '@mesaaberta/core/moderation/reports';
import { placeOwnerSchema } from '@mesaaberta/core/places/claims';
import { removePlaceOwner } from '@mesaaberta/core/server/places/claims';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { loadRead } from '#lib/server/reads/load.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadRead(event, 'place');

const report = moderationAction(reportPlaceSchema, ['id', 'reason', 'details'], {
  path: '/v1/reports/place',
});

// "Deixar de gerenciar": the owner hands the place back. Their edits go through review again.
const release = moderationAction(placeOwnerSchema, ['id'], (db, actor, { id }) =>
  removePlaceOwner(db, actor, id),
);

export const actions: Actions = {
  // "Denunciar lugar". The service refuses a place the member looks after and a repeat while one
  // waits; enough open reports hide the place until an admin decides.
  report: async (event) => {
    await requireDirectory(event.locals, 'places');
    return report(event);
  },
  release: async (event) => {
    await requireDirectory(event.locals, 'places');
    return release(event);
  },
};
