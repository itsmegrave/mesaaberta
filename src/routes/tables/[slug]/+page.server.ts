import { error } from '@sveltejs/kit';
import { can, joinBlocker } from '$lib/server/auth/policy';
import { Invalid } from '$lib/server/errors';
import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { runRegistrationAction } from '$lib/server/registrations/form-action';
import {
	approveRegistration,
	declineRegistration,
	joinTable,
	leaveTable,
	listRegistrations,
	registrationStatus,
	removePlayer
} from '$lib/server/registrations/service';
import { findTableBySlug } from '$lib/server/tables/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
	// Unknown, disabled, or no database at all: the same translated 404.
	const found = locals.db && (await findTableBySlug(locals.db, params.slug, new Date()));
	if (!found) error(404, 'Not found');

	const { gmId, id, imagePath, ...table } = found;
	const signedIn = (await locals.getUser()) !== null;
	const profile = await locals.getProfile().catch(() => null);

	// The player's own place, and the GM's view of everyone's. Names are not public.
	const myStatus = profile ? await registrationStatus(locals.db!, id, profile.id) : null;
	const manage = can(profile, 'registration:manage', { gmId });
	const canJoin =
		joinBlocker(profile, {
			gmId,
			tableStatus: 'active',
			seatsLeft: table.seatsLeft,
			alreadyRegistered: myStatus !== null
		}) === null;

	return {
		table: { ...table, imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath) },
		canEdit: can(profile, 'table:edit', { gmId }),
		signedIn,
		isGm: profile?.id === gmId,
		myStatus,
		canJoin,
		registrations: manage ? await listRegistrations(locals.db!, profile, params.slug) : null
	};
};

const playerIdOf = (form: FormData) => {
	const playerId = String(form.get('playerId') ?? '');
	if (!/^[0-9a-f-]{36}$/i.test(playerId)) throw new Invalid('playerId');

	return playerId;
};

// Each action runs a registration operation as the signed-in player (see runRegistrationAction).
export const actions: Actions = {
	join: (event) =>
		runRegistrationAction(event, (db, actor) => joinTable(db, actor, event.params.slug)),
	leave: (event) =>
		runRegistrationAction(event, (db, actor) => leaveTable(db, actor, event.params.slug)),
	approve: (event) =>
		runRegistrationAction(event, (db, actor, form) =>
			approveRegistration(db, actor, event.params.slug, playerIdOf(form))
		),
	decline: (event) =>
		runRegistrationAction(event, (db, actor, form) =>
			declineRegistration(db, actor, event.params.slug, playerIdOf(form))
		),
	remove: (event) =>
		runRegistrationAction(event, (db, actor, form) =>
			removePlayer(db, actor, event.params.slug, playerIdOf(form))
		)
};
