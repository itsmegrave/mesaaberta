import { loadRead } from '#lib/server/reads/load.js';
import { publishSocialAction } from '#lib/server/admin/social-action.js';
import { tableActions } from '#lib/server/moderation/admin-actions.js';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = (event) => loadRead(event, 'adminTables');
export const actions: Actions = { publish: publishSocialAction, close: tableActions.close };
