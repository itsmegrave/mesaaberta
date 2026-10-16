import { defineEnvVars } from '@sveltejs/kit/env';

// The variables the app reads through SvelteKit (`$app/env/public`). Everything else the server needs
// comes from the host's bindings and settings (see `src/lib/server/host`), not from here.
//
// Both are optional: the browser reports to Sentry only when `PUBLIC_SENTRY_DSN` is set, and only from
// `PUBLIC_SENTRY_ORIGIN` when that is set too. They are read when the app starts, not at build time,
// so one build serves any deployment.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
  PUBLIC_SENTRY_DSN: { public: true, static: false, schema: optional },
  PUBLIC_SENTRY_ORIGIN: { public: true, static: false, schema: optional },
});
