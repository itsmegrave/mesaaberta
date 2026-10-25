import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The browser keeps the fragment across the redirect; `url.hash` is unavailable in a load.
export const load: PageLoad = ({ url }) => redirect(308, `/novidades${url.search}`);
