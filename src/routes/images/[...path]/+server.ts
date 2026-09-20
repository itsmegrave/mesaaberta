import { error } from '@sveltejs/kit';
import { serveImage } from '$lib/server/images';
import type { RequestHandler } from './$types';

// Table images, read from the R2 bucket. They go through the Worker (not a public bucket domain) so
// the images stay on this origin: no custom domain to set up and nothing to add to the CSP.
export const GET: RequestHandler = async ({ params, platform }) => {
	const response = await serveImage(platform?.env.IMAGES, params.path);

	return response ?? error(404);
};
