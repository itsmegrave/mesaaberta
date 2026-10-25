/** The local api the dev server talks to (`bun run dev:local`). Not the e2e one (4185), so both can run. */
export const DEV_API_PORT = 4195;
/** The local api's shared secret. Not a secret: the api only listens on this machine. */
export const DEV_API_TOKEN = 'mesaaberta-dev-only';
