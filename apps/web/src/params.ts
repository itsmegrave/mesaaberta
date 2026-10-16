import { defineParams } from '@sveltejs/kit/params';
import { providers, type Provider } from '@mesaaberta/core/auth/providers';

/** The sign-in providers the app offers, for `[provider=provider]` in a route. */
export const matchProvider = (param: string): Provider | undefined =>
  (providers as readonly string[]).includes(param) ? (param as Provider) : undefined;

export const params = defineParams({ provider: matchProvider });
