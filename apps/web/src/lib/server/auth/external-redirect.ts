/**
 * Where a sign-in or a connect may send the browser: out to Supabase Auth, which sends it on to the
 * provider. SvelteKit 3 refuses an external redirect unless the origin is allowed, so it is the
 * project's own (`SUPABASE_URL`), never whatever address came back.
 */
export const supabaseOnly = (env: { SUPABASE_URL?: string } | undefined) => ({
  external: env?.SUPABASE_URL ? [new URL(env.SUPABASE_URL).origin] : [],
});
