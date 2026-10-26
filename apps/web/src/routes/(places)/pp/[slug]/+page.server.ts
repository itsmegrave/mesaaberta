import { reportPlaceSchema } from '@mesaaberta/core/moderation/reports';
import { filePlaceReport } from '@mesaaberta/core/server/places/service';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { loadRead } from '#lib/server/reads/load.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadRead(event, 'place');

const report = moderationAction(
  reportPlaceSchema,
  ['id', 'reason', 'details'],
  (db, actor, { id, reason, details }) => filePlaceReport(db, actor, id, { reason, details }),
  { player: { path: '/v1/reports/place' } },
);

export const actions: Actions = {
  // "Denunciar lugar". The service refuses a place the member looks after and a repeat while one
  // waits; enough open reports hide the place until an admin decides.
  report: async (event) => {
    await requireDirectory(event.locals, 'places');
    return report(event);
  },
};
