import { loadRead } from '$lib/server/reads/load';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = (event) => loadRead(event, 'tables');
