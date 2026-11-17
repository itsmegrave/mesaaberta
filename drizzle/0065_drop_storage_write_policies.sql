-- Uploads and deletes go through the server's own Storage client with the secret key (#445), so
-- signed-in people no longer need to write to Storage themselves. These policies let anyone signed
-- in put files into the buckets with the public key, skipping the server's checks (size, type by
-- first bytes, random names). The buckets stay public to read, which needs no policy.
--
-- Safe anywhere, like 0018: a Postgres without Supabase's `storage` schema skips it, a policy
-- already gone is fine, and a role that may not change `storage.objects` leaves a notice instead of
-- failing the deploy. Rollback: run 0018's and 0036's policy SQL again.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "signed-in users can upload table images" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "users manage their own avatar" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "users manage their own partner logos" ON storage.objects';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'storage write policies not dropped (%): run this migration''s SQL in the Supabase SQL editor', SQLERRM;
  END;
END $$;
