import { loadRead } from '$lib/server/reads/load';
import { publishInstagramAction } from '$lib/server/admin/instagram-action';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = (event) => loadRead(event, 'adminTables');
export const actions: Actions = { publish: publishInstagramAction };
