import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { Forbidden, NotFound } from '$lib/server/errors';
import { imageUrl, pictureOf, supabaseUrlOf } from '$lib/server/images';
import { loadManage } from '$lib/server/tables/manage';
import type { PageServerLoad } from './$types';

// The GM's page for one table: requests, players, recent activity. Approving, declining and removing
// post to the table page's own actions (see ActionForm), which send the browser back here.
export const load: PageServerLoad = async ({ locals, url, params, platform }) => {
	await requireUser(locals, url);
	if (!locals.db) error(503, 'Database not configured');

	try {
		const manage = await loadManage(locals.db, await locals.getProfile(), params.slug, new Date());
		const supabaseUrl = supabaseUrlOf(platform?.env);
		const withPicture = <T extends { avatarUrl: string | null; avatarPath: string | null }>({
			avatarUrl,
			avatarPath,
			...rest
		}: T) => ({ ...rest, avatarUrl: pictureOf(supabaseUrl, { avatarUrl, avatarPath }) });

		// The GM's id stays on the server; the page only needs names and pictures.
		const { gmId, id, imagePath, ...table } = manage.table;
		return {
			table: { ...table, imageUrl: imageUrl(supabaseUrl, imagePath) },
			gm: withPicture(manage.gm),
			gmRating: manage.gmRating,
			requests: manage.requests.map(withPicture),
			players: manage.players.map(withPicture),
			activity: manage.activity
		};
	} catch (e) {
		if (e instanceof Forbidden) error(403, 'Forbidden');
		if (e instanceof NotFound) error(404, 'Not found');
		throw e;
	}
};
