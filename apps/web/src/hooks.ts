import type { Reroute } from '@sveltejs/kit/hooks';
import { canonicalPath } from '@mesaaberta/core/routes';

// A legacy POST reaches the canonical action directly, with its original body and method.
export const reroute: Reroute = ({ url }) => canonicalPath(url.pathname);
