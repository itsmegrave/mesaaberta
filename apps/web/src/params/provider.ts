import type { ParamMatcher } from '@sveltejs/kit';
import { providers, type Provider } from '@mesaaberta/core/auth/providers';

export const match: ParamMatcher = (param): param is Provider =>
  (providers as readonly string[]).includes(param);
