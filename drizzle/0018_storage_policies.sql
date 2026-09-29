-- The Storage policies the uploads need, which the README used to leave as a one-time step in the
-- Supabase SQL editor. Production never got them: `storage.objects` had RLS on and no policy, so
-- every upload was refused (`upload_failed` on the image field). Uploads go through the signed-in
-- person's Supabase client, so RLS applies to them.
--
-- Safe anywhere: a Postgres without Supabase's `storage` schema (the Docker one, PGlite in the
-- tests) skips it, a policy already there is replaced with the same one, and a role that may not
-- change `storage.objects` leaves a notice instead of failing the deploy.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    -- Table images: any signed-in person uploads under a random name; the bucket is public to read.
    EXECUTE 'DROP POLICY IF EXISTS "signed-in users can upload table images" ON storage.objects';
    EXECUTE $sql$
      CREATE POLICY "signed-in users can upload table images" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'table-images')
    $sql$;

    -- Profile pictures: each person writes, replaces and deletes only inside a folder named after
    -- their user id.
    EXECUTE 'DROP POLICY IF EXISTS "users manage their own avatar" ON storage.objects';
    EXECUTE $sql$
      CREATE POLICY "users manage their own avatar" ON storage.objects
        FOR ALL TO authenticated
        USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
        WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    $sql$;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'storage policies not applied (%): run this migration''s SQL in the Supabase SQL editor', SQLERRM;
  END;
END $$;
