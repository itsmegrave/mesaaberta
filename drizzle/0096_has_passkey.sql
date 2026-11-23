-- Whether an account has a passkey, for the `has_passkey` and `no_passkey` audience segments (a
-- popup that asks people to add one). Supabase Auth keeps passkeys in `auth.webauthn_credentials`
-- (auth migration 20260302000000). Null when that table cannot be read (a Postgres without
-- Supabase Auth, PGlite in the tests, a role without access): such an account is then in neither
-- segment, so nobody is aimed at by mistake and the admin's reach shows 0.
--
-- PL/pgSQL plans the query only when it runs, so a missing table fails inside the function, where
-- the handler catches it, and never at migration time.
CREATE OR REPLACE FUNCTION public.has_passkey(account uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.webauthn_credentials WHERE user_id = account);
EXCEPTION
  WHEN undefined_table OR invalid_schema_name OR insufficient_privilege THEN
    RETURN NULL;
END;
$$;
--> statement-breakpoint
-- Not callable through Supabase's public API (PostgREST exposes `public` functions): only the
-- server's own connection, which owns it, runs it.
REVOKE ALL ON FUNCTION public.has_passkey(uuid) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.has_passkey(uuid) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.has_passkey(uuid) FROM authenticated';
  END IF;
END $$;
