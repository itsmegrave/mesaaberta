import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { can, joinBlocker, rateBlocker } from '$lib/server/auth/policy';
import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import {
	firstSessionEnded,
	gmRating,
	ratingOf,
	submitRating,
	tableRating
} from '$lib/server/ratings/service';
import { ratingSchema } from '$lib/tables/rating';
import { playerActionSchema, tableActionSchema } from '$lib/tables/registration';
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

	// Averages are public; the comment is not sent to anyone but its author.
	const [tableScore, gmScore, mine] = await Promise.all([
		tableRating(locals.db!, id),
		gmRating(locals.db!, gmId),
		profile ? ratingOf(locals.db!, id, profile.id) : null
	]);
	const canRate =
		rateBlocker(profile, {
			gmId,
			registration: myStatus,
			firstSessionEnded: firstSessionEnded(found, new Date())
		}) === null;

	return {
		ratings: { table: tableScore, gm: gmScore },
		canRate,
		myRating: mine && {
			tableScore: mine.tableScore,
			gmScore: mine.gmScore,
			comment: mine.comment ?? ''
		},
		ratingForm: await superValidate(
			mine
				? { tableScore: mine.tableScore, gmScore: mine.gmScore, comment: mine.comment ?? '' }
				: {},
			zod4(ratingSchema),
			{ errors: false }
		),
		table: { ...table, imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath) },
		canEdit: can(profile, 'table:edit', { gmId }),
		signedIn,
		isGm: profile?.id === gmId,
		myStatus,
		canJoin,
		registrations: manage ? await listRegistrations(locals.db!, profile, params.slug) : null
	};
};

// Each action runs a registration operation as the signed-in player (see runRegistrationAction).
export const actions: Actions = {
	join: (event) =>
		runRegistrationAction(event, tableActionSchema, (db, actor) =>
			joinTable(db, actor, event.params.slug)
		),
	leave: (event) =>
		runRegistrationAction(event, tableActionSchema, (db, actor) =>
			leaveTable(db, actor, event.params.slug)
		),
	approve: (event) =>
		runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
			approveRegistration(db, actor, event.params.slug, playerId)
		),
	decline: (event) =>
		runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
			declineRegistration(db, actor, event.params.slug, playerId)
		),
	rate: (event) =>
		runRegistrationAction(event, ratingSchema, (db, actor, data) =>
			submitRating(db, actor, event.params.slug, {
				tableScore: data.tableScore,
				gmScore: data.gmScore,
				comment: data.comment || null
			})
		),
	remove: (event) =>
		runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
			removePlayer(db, actor, event.params.slug, playerId)
		)
};
