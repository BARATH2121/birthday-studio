-- =============================================================================
-- Phase 5 — Save and Share Birthday
-- Table, constraints, RLS, public read function and photo storage bucket.
--
-- Apply with the Supabase CLI:
--   supabase init                                   (once, creates supabase/config.toml)
--   supabase link --project-ref <project-ref>
--   supabase db push --dry-run                      (preview)
--   supabase db push                                (apply)
-- Verify with:
--   supabase migration list
--   supabase db lint --linked
--   supabase db advisors --linked
--   supabase gen types typescript --linked > lib/supabase/database.types.ts
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
--
-- Storage rules for this table (see section 3 for the reasoning):
--   * `id` is an internal surrogate key. It is never selected by application
--     code and never appears in a URL.
--   * `public_id` is the only identifier that leaves the server. It is a
--     128-bit cryptographically random lowercase hex string. Lowercase is
--     deliberate: a link retyped in the wrong case still resolves.
--   * Deliberately NOT stored: email, phone, password, address/location,
--     IP address, device data, or any creator identity. There is no
--     `created_by` column because Phase 5 has no accounts.
-- -----------------------------------------------------------------------------
create table if not exists public.birthday_pages (
  id bigint generated always as identity primary key,

  -- 32 hex chars = 128 bits. gen_random_bytes() has been part of core
  -- pg_catalog since PostgreSQL 13, so no pgcrypto extension is required here.
  public_id text not null
    default encode(gen_random_bytes(16), 'hex'),

  name text not null,

  -- Default is 'Other' rather than '' because the CHECK below only permits the
  -- nine real labels: a '' default would make every INSERT that omitted the
  -- column fail its own constraint, which is a confusing error to debug. The
  -- app always sends an explicit value, so the default only affects hand-written
  -- SQL.
  relationship text not null default 'Other',
  message text not null,

  style text not null,

  -- Ordered object paths inside the `birthday-photos` bucket, not URLs and
  -- never base64/binary. Array order IS the display order.
  photo_paths text[] not null default '{}'::text[],

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint birthday_pages_public_id_format
    check (public_id ~ '^[0-9a-f]{32}$'),

  constraint birthday_pages_public_id_unique
    unique (public_id),

  constraint birthday_pages_name_length
    check (char_length(btrim(name)) between 1 and 80),

  constraint birthday_pages_relationship_allowed
    check (relationship in (
      'Friend', 'Best Friend', 'Sister', 'Brother',
      'Girlfriend', 'Boyfriend', 'Mother', 'Father', 'Other'
    )),

  constraint birthday_pages_message_length
    check (char_length(message) between 1 and 500),

  constraint birthday_pages_style_allowed
    check (style in (
      'romantic', 'cute-colorful', 'elegant', 'fun-crazy', 'cinematic'
    )),

  -- Keeps a single anonymous creator from writing an unbounded payload.
  constraint birthday_pages_photo_count
    check (coalesce(array_length(photo_paths, 1), 0) between 0 and 20)
);

comment on table public.birthday_pages is
  'Public, shareable birthday pages. Read by public_id via get_birthday_page(); created anonymously; never updated or deleted by clients.';
comment on column public.birthday_pages.id is
  'Internal surrogate key. Never exposed publicly and never used in a URL.';
comment on column public.birthday_pages.public_id is
  '128-bit random public identifier. The only identifier used in share URLs.';
comment on column public.birthday_pages.photo_paths is
  'Ordered object paths in the birthday-photos bucket. Array order is display order.';

-- Keep updated_at honest for any future privileged update path.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists birthday_pages_touch_updated_at on public.birthday_pages;
create trigger birthday_pages_touch_updated_at
  before update on public.birthday_pages
  for each row execute function public.touch_updated_at();

-- Object paths are always "<public_id>/<file>". Enforced here rather than with
-- a CHECK constraint because a CHECK cannot contain a subquery, and this needs
-- to inspect every element of the array.
--
-- Why it matters: without it, a hostile client could INSERT a row whose
-- photo_paths point at another birthday's photo folder and thereby render
-- someone else's photos on their own page. It is the storage-side twin of the
-- upload policy in section 5a.
create or replace function public.assert_photo_paths_scoped()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item text;
begin
  foreach item in array coalesce(new.photo_paths, '{}'::text[]) loop
    if item is null then
      raise exception 'photo_paths must not contain null'
        using errcode = 'check_violation';
    end if;

    if item !~ ('^' || new.public_id || '/[0-9a-z-]{1,64}\.(jpg|png|webp)$') then
      raise exception 'photo_paths entries must be "<public_id>/<file>" inside the page folder'
        using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists birthday_pages_photo_paths_scoped on public.birthday_pages;
create trigger birthday_pages_photo_paths_scoped
  before insert or update on public.birthday_pages
  for each row execute function public.assert_photo_paths_scoped();

-- -----------------------------------------------------------------------------
-- 2. Grants — explicitly narrow.
--
-- Postgres checks table GRANTS first and RLS policies second:
--   * missing grant  -> permission error (denied)
--   * policy matches no rows -> empty result (also denied here)
-- Revoking by name (rather than relying on Supabase's default grants) means a
-- future dashboard change cannot silently re-open UPDATE/DELETE.
-- -----------------------------------------------------------------------------
revoke all on table public.birthday_pages from anon, authenticated;

-- Only INSERT is reachable on the table with a publishable key.
--
-- SELECT is deliberately NOT granted. The public read path is the
-- SECURITY DEFINER function in section 4, which can only ever return the single
-- row matching one exact id. See section 3 for why a table-level SELECT grant
-- would reintroduce bulk enumeration.
--
-- Application code must therefore never use `.insert(...).select(...)`: a
-- PostgREST `RETURNING` clause needs SELECT privilege and would fail. The
-- create flow inserts without RETURNING and uses the id it generated itself.
grant insert on table public.birthday_pages to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
--
-- Threat model for this table:
--   The page is intentionally public. Anyone holding the 128-bit `public_id`
--   may read it. There is no secret content to protect beyond "you must know
--   the id", so possession of the id is the capability.
--
--   The thing that MUST NOT be possible is bulk enumeration. A
--   `for select ... using (true)` policy would let anyone run
--   `GET /rest/v1/birthday_pages?select=*` and dump every message and photo
--   path on the site in one request. RLS cannot distinguish "filtered by
--   public_id" from "list everything", because it is evaluated per row and
--   every row passes.
--
--   Therefore: anon gets NO select grant on the table at all. Reads go through
--   the SECURITY DEFINER function in section 4, which is hard-wired to return
--   at most the single row matching one exact id.
-- -----------------------------------------------------------------------------
alter table public.birthday_pages enable row level security;

-- 3a. INSERT — open, because Phase 5 has no accounts.
--
-- Why this is acceptable and why it is still narrow:
--   * An INSERT can only ADD a row. It cannot read, alter or remove any
--     existing row, so it cannot be used to deface or delete anyone's page.
--   * Every field is constrained in section 1 (lengths, enumerations, photo
--     count, path scoping), so a hostile client cannot store unbounded text,
--     an unexpected style, or a path pointing into someone else's folder.
--   * The unique index on public_id prevents overwriting: a colliding insert
--     fails rather than replacing an existing page.
-- Known, accepted limitation: without accounts there is no rate limit, so a
-- determined client can create junk rows (storage-cost / spam abuse). That is
--   a Phase 6 concern — see docs/phase5-supabase-setup.md for the mitigations
--   (Edge Function rate limiting, CAPTCHA, or requiring sign-in to create).
--
-- Dropped first so the whole migration is safely re-runnable. `create policy`
-- has no `if not exists` form, so without this a second run against an
-- already-migrated project aborts with
--   ERROR: policy "..." for table "..." already exists
-- and, because the Dashboard runs a script as one implicit transaction, that
-- would take the whole re-run down with it.
drop policy if exists "anyone can create a birthday page" on public.birthday_pages;

create policy "anyone can create a birthday page"
  on public.birthday_pages
  for insert
  to anon, authenticated
  with check (true);

-- 3b. SELECT — deliberately absent on the table (see section 3 header).
--     There is intentionally NO policy like "anyone can read birthday pages".
--
-- 3c. UPDATE — deliberately absent, and UPDATE is not granted.
--     A client therefore cannot modify a page it did not create, or any page
--     at all, including its own. This is what makes a shared link effectively
--     write-once from the browser's point of view.
--
-- 3d. DELETE — deliberately absent, and DELETE is not granted.
--     Nobody can remove a page from the client. Removal is an operator action
--     via the SQL editor / service-role key.
--
-- Because 3b–3d have neither a grant nor a policy, an anonymous
--   PATCH /rest/v1/birthday_pages?public_id=eq.<id>
--   DELETE /rest/v1/birthday_pages?public_id=eq.<id>
--   GET   /rest/v1/birthday_pages?select=*
-- are all rejected by Postgres.

-- -----------------------------------------------------------------------------
-- 4. Public read function
--
-- This is the only way an anonymous visitor can read a birthday page.
--
-- SECURITY DEFINER is required because the caller has no SELECT grant on the
-- table. The function is written so that the privilege it holds cannot be
-- redirected:
--   * it is a plain SQL function with a single, fully-qualified SELECT;
--   * `search_path` is pinned to `public, pg_temp`, so no object outside the
--     schema can be substituted into the query;
--   * it returns only the seven columns the page renders, so the internal
--     `id` is never returned to any caller;
--   * it filters on one exact id, so it can only ever return 0 or 1 rows;
--   * it is STABLE and takes no other input, so it cannot be used to
--     enumerate or aggregate.
-- -----------------------------------------------------------------------------
create or replace function public.get_birthday_page(p_public_id text)
returns table (
  public_id text,
  name text,
  relationship text,
  message text,
  style text,
  photo_paths text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.public_id,
    b.name,
    b.relationship,
    b.message,
    b.style,
    b.photo_paths,
    b.created_at
  from public.birthday_pages b
  where b.public_id = p_public_id
    and p_public_id ~ '^[0-9a-f]{32}$';
$$;

comment on function public.get_birthday_page(text) is
  'Returns one birthday page by its 128-bit public_id, or no rows. The only anonymous read path; never returns the internal id.';

-- EXECUTE is not granted to PUBLIC by default for functions, but be explicit:
-- revoke first so re-running this migration cannot accumulate privileges.
revoke all on function public.get_birthday_page(text) from public;
grant execute on function public.get_birthday_page(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Photo storage
--
-- Model: PUBLIC bucket.
--
-- This is a deliberate trade-off, not an oversight. The birthday page is meant
-- to be opened by a recipient on a device we do not control, and the photos
-- are part of that page. A signed-URL design would need per-view URL minting,
-- an expiry lifecycle, and a refresh path for long-lived pages and CDN
-- caching — real complexity for no privacy gain on a page that is public by
-- definition. What the public model does buy us:
--   * stable, cacheable, CDN-friendly image URLs;
--   * no expiry bugs where a shared link shows broken images later.
-- What it costs, stated plainly: anyone who obtains a photo URL can fetch that
-- image. URLs are namespaced under a 128-bit random folder and are only
-- published to people who already have the page link, but this must be
-- explained to creators before they generate. See the Generate screen copy.
--
-- If a future phase needs private photos, the migration path is: set
-- public = false on this bucket, add a `select` policy keyed to a claim, and
-- mint signed URLs in the public page's Server Component. The application
-- only ever stores `photo_paths`, so that switch needs no schema change.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'birthday-photos',
  'birthday-photos',
  true,
  10485760, -- 10 MB, matches PHOTO_MAX_BYTES in the app
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5a. INSERT — anonymous uploads are allowed, but only into a well-formed
--      folder belonging to a 32-hex-char page id, with an image extension.
--      The bucket's own file_size_limit / allowed_mime_types above act as a
--      server-side backstop for the app's client-side checks.
--
--      This is the only write policy on storage.objects.
--
--      Table-level privileges on storage.objects are intentionally NOT granted
--      here. Supabase's defaults already give `anon` INSERT on that table, and
--      the policy below is the control. Adding an explicit GRANT here would
--      widen the blast radius of a future mistake — if the policy were ever
--      dropped, an explicit grant would let anyone write to any bucket in the
--   project, whereas the default grant set is narrower.
--
-- Dropped first for the same reason as section 3a: `create policy` has no
-- `if not exists` form, and this policy lives on a shared Supabase-owned table
-- where a name collision is the likeliest failure of all.
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

-- The path is matched with split_part() rather than storage.foldername(name).
--
-- This is not a style preference, it is a fix for an observed live failure.
-- The first version of this policy read:
--
--     (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$'
--     and (storage.foldername(name))[2] ~ '^[0-9a-z-]{1,64}\.(jpg|png|webp)$'
--
-- Against a live project that policy rejected *every* anonymous upload with
-- "new row violates row-level security policy" — including perfectly valid
-- ones — while the secret key uploaded the same object successfully. The
-- uniform failure, including for well-formed paths, means the check evaluated
-- to NULL rather than false: if the policy had merely been missing, or if
-- foldername() had returned fewer segments, `[2]` would be NULL, `NULL ~ '...'`
-- is NULL, and a NULL with-check denies the row.
--
-- split_part() operates on the column directly and has no dependency on
-- storage helper-function semantics, so it cannot drift between Supabase
-- versions.
--
-- The array_length() clause is the reason this is still safe: it pins the path
-- to exactly two segments, so `a/b/c.png`, a doubled slash, and any `../`
-- traversal are all rejected. Without it, split_part(name,'/',2) would happily
-- return "b" for "a/b/c.png" and let a deeper path through.

-- 5b. SELECT — intentionally no policy. Reads of a public bucket are served
--      by Storage's public endpoint (/object/public/<bucket>/<path>) and do
--      not pass through RLS. Adding a `select ... using (true)` policy here
--      would only re-open bulk enumeration of every object in the bucket.
--
-- 5c. UPDATE — no policy and no grant. A client cannot overwrite an existing
--      object, so an attacker cannot replace the photos on a page that is
--      already shared. (Upserts are also disabled in application code.)
--
-- 5d. DELETE — no policy and no grant. A client cannot delete anything.
--      This is what makes the server-side orphan cleanup in
--      app/actions/cleanup-orphan-photos.ts necessary and safe to expose: it
--      is the only delete path, it runs with the secret key server-side, and
--      it refuses to delete any folder that a live row still references.
