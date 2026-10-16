import { loadRead } from '#lib/server/reads/load.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadRead(event, 'adminUsers');
