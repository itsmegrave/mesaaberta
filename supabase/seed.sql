-- Runs when the local stack is first created. Idempotent, so it is also safe to run by hand.
-- The same policy production needs (see the README, "Managing tables"): a signed-in user may upload
-- to the table-images bucket. The bucket itself is declared in config.toml.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'signed-in users can upload table images'
  ) then
    create policy "signed-in users can upload table images" on storage.objects
      for insert to authenticated with check (bucket_id = 'table-images');
  end if;
end $$;
