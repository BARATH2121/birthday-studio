-- =============================================================================
-- Phase 5 hotfix — storage upload policy
--
-- WHY YOU NEED THIS
-- The first run of 20260930120000_birthday_pages.sql created the storage
-- upload policy using storage.foldername(name). Against this project that
-- policy denies EVERY anonymous photo upload with:
--
--   HTTP 400 {"statusCode":"403","error":"Unauthorized",
--             "message":"new row violates row-level security policy",
--             "code":"AccessDenied"}
--
-- Valid paths were rejected just as firmly as invalid ones, and the secret key
-- could upload the same object fine, so storage itself is healthy and the fault
-- is the with-check. `[2]` was coming back NULL, and a NULL with-check denies
-- the row — which is why nothing matched.
--
-- WHAT IT CHANGES
-- Only how the object path is matched. It swaps storage.foldername() for
-- split_part() on the column itself, which cannot drift between Supabase
-- versions, and adds an explicit two-segment guard so deeper paths and `../`
-- traversal stay blocked.
--
-- The security posture is unchanged and no policy is loosened:
--   * same bucket, same roles (anon, authenticated), same `for insert` only
--   * folder must still be exactly 32 lowercase hex characters
--   * filename must still match [0-9a-z-]{1,64}\.(jpg|png|webp)
--   * still no SELECT, UPDATE or DELETE policy
--   * now ALSO rejects any path that is not exactly "<32hex>/<file>"
--
-- SAFE TO RE-RUN: the drop is `if exists`, and this replaces a policy rather
-- than adding one.
-- =============================================================================

drop policy if exists "anyone can upload photos into a new page folder" on storage.objects;

create policy "anyone can upload photos into a new page folder"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'birthday-photos'
    and split_part(name, '/', 1) ~ '^[0-9a-f]{32}$'
    and split_part(name, '/', 2) ~ '^[0-9a-z-]{1,64}\.(jpg|png|webp)$'
    and array_length(string_to_array(name, '/'), 1) = 2
  );

-- -----------------------------------------------------------------------------
-- Confirm: should report 1, 0, 0, 0  (policy present, still insert-only)
-- -----------------------------------------------------------------------------
select
  count(*) filter (where policyname = 'anyone can upload photos into a new page folder') as upload_policy,
  count(*) filter (where cmd = 'SELECT') as select_policies,
  count(*) filter (where cmd = 'UPDATE') as update_policies,
  count(*) filter (where cmd = 'DELETE') as delete_policies
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
