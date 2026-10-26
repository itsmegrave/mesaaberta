-- Runs after Storage has migrated, on every start (`docker compose up`). Safe to run again.
--
-- What a Supabase Postgres grants on its own: the API roles may use the `storage` and `auth`
-- schemas, and the RLS policies decide what each one sees. The upload policies come from the app's
-- migrations (0018_storage_policies, 0036_partners).
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role;
-- The policies call auth.uid().
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

-- The buckets the uploads go to, as configured in production (see the README, "Managing tables"
-- and "Profile pictures"). A bucket already there is left as it is.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('table-images', 'table-images', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('profile-avatars', 'profile-avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
