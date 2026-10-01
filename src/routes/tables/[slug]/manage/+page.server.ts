import { loadRead } from '$lib/server/reads/load';
import { confirmationActions } from '$lib/server/tables/confirmation-actions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadRead(event, 'manage');

// The answer to "did the session happen?" once its date has passed.
export const actions: Actions = confirmationActions;
