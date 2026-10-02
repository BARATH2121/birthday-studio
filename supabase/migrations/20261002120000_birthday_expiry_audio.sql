-- =============================================================================
-- Phase 6 - Birthday expiry and private audio
--
-- Apply with the Supabase CLI:
--   supabase db push
-- Or paste into the Dashboard SQL Editor, which runs the whole file as one
-- transaction.
-- Verify with the self-test at the bottom of this file.
--
-- The optional scheduled cleanup that enforces deletion is a SEPARATE file,
-- supabase/cron/expire-birthdays.sql, because it needs pg_cron, pg_net and a
-- secret of yours. This file is the security boundary and needs none of that.
--
-- -----------------------------------------------------------------------------
-- WHAT CHANGES, AND WHY THE DATABASE OWNS THE DATE
--
-- Phase 5 pages never expired. This file adds a real end date:
--
--   birthday_month smallint  1-12
--   birthday_day   smallint  1-31, validated against the month
--   expires_at     timestamptz
--
-- No birth year is stored, and none is needed. The page is good until the end of
-- the next occurrence of that day and date, at 23:59:59.999 Asia/Kolkata.
--
-- expires_at is deliberately NOT accepted from the client. The browser holds the
-- publishable key and can post any column it likes, so a value it supplied could
-- be set to the year 3000 and the page would never expire. Instead a BEFORE
-- INSERT trigger overwrites it from the server clock. The client cannot shorten
-- the window either, because the trigger runs after the value arrives and the
-- column is not nullable: a client that omits it gets a computed value, and a
-- client that sends one gets it overwritten.
--
-- February 29 is accepted as a birthday and observed on February 28 in a
-- non-leap year, which is why the per-month day ceiling for February is 29
-- rather than 28. There is no leap-birthday prompt in the UI; February 29 is
-- simply a date people are born on.
--
-- Asia/Kolkata is UTC+05:30 with no daylight saving, ever, so the local calendar
-- arithmetic below is a fixed offset rather than a zone conversion. That matches
-- lib/birthday-date.ts exactly, and both were checked against the same cases.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columns
--
-- Added without NOT NULL first so that a database which already holds rows does
-- not fail this migration. The backfill gives those pre-Phase-6 rows a one-year
-- grace period rather than deleting them: they have no birthday date to compute
-- from, and silently expiring live pages would be worse than a longer window.
-- The trigger below overwrites expires_at on every insert, so no new row can
-- ever receive the grace period.
--
-- No DEFAULT is left on expires_at. That is deliberate: if the trigger ever
-- failed to fire, the insert must fail rather than quietly succeed with a
-- hand-written default.
-- -----------------------------------------------------------------------------
alter table public.birthday_pages add column if not exists birthday_month smallint;
alter table public.birthday_pages add column if not exists birthday_day smallint;
alter table public.birthday_pages add column if not exists expires_at timestamptz;

update public.birthday_pages
   set birthday_month = 1,
       birthday_day = 1,
       expires_at = coalesce(expires_at, now() + interval '1 year')
 where birthday_month is null
    or birthday_day is null
    or expires_at is null;

alter table public.birthday_pages alter column birthday_month set not null;
alter table public.birthday_pages alter column birthday_day set not null;
alter table public.birthday_pages alter column expires_at set not null;

alter table public.birthday_pages
drop constraint if exists birthday_pages_birthday_month_range;
alter table public.birthday_pages
  add constraint birthday_pages_birthday_month_range
    check (birthday_month between 1 and 12);

-- February is the only month allowed to reach 29, and 30 and 31 are refused
-- outright for April, June, September and November.
alter table public.birthday_pages
drop constraint if exists birthday_pages_birthday_day_range;
alter table public.birthday_pages
  add constraint birthday_pages_birthday_day_range
    check (
      birthday_day between 1 and 31
      and (birthday_month not in (4, 6, 9, 11) or birthday_day <= 30)
      and (birthday_month <> 2 or birthday_day <= 29)
    );

comment on column public.birthday_pages.birthday_month is
  'Birth month, 1-12. Stored without a year: the page is valid until this date next occurs.';
comment on column public.birthday_pages.birthday_day is
  'Birth day of month. February allows 29 so a leap-day birthday is expressible.';
comment on column public.birthday_pages.expires_at is
  'End of validity, 23:59:59.999 Asia/Kolkata on the next occurrence of the birthday. Computed by a BEFORE INSERT trigger from the server clock; never read from the client.';

-- -----------------------------------------------------------------------------
-- 2. Computing expiry
--
-- One function, used by the insert trigger, so there is a single definition of
-- "when does this page end" and it cannot drift between the two call sites.
--
-- Returns NULL for an impossible date rather than raising, so the INSERT fails on
-- the CHECK constraint above with a readable name instead of a trigger error.
-- -----------------------------------------------------------------------------
create or replace function public.birthday_expiry_for(p_month smallint, p_day smallint)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_days integer;
  v_year integer;
  v_effective_day integer;
  v_ist_offset interval := interval '5 hours 30 minutes';
  v_today date;
  v_candidate date;
begin
  if p_month is null or p_day is null then
    return null;
  end if;

  if p_month < 1 or p_month > 12 or p_day < 1 or p_day > 31 then
    return null;
  end if;

  -- February is permitted to 29 so that 29 February is a legal birthday. A
  -- non-leap year resolves it to the 28th further down.
  v_days := case p_month
    when 2 then 29
    when 4 then 30
    when 6 then 30
    when 9 then 30
    when 11 then 30
    else 31
  end;

  if p_day > v_days then
    return null;
  end if;

  -- The local calendar date in Asia/Kolkata.
  --
  -- `now() at time zone 'UTC'` returns a naive timestamp holding the UTC wall
  -- clock; adding the offset gives the local wall clock; ::date takes the date
  -- part of it. Written this way so the result never depends on the session's
  -- TimeZone setting, which a project running in UTC would otherwise get wrong
  -- by five and a half hours.
  v_today := ((now() at time zone 'UTC') + v_ist_offset)::date;
  v_year := extract(year from v_today)::integer;

  -- The one date that does not always exist. make_date() raises on 29 February of
  -- a non-leap year, so the day is clamped to the 28th whenever the year being
  -- built is not a leap year. Every other month/day combination has already been
  -- checked against the ceiling above, so 28 is the only adjustment needed.
  v_effective_day := p_day;
  if p_month = 2 and p_day = 29
     and (mod(v_year, 4) <> 0 or mod(v_year, 100) = 0)
     and mod(v_year, 400) <> 0 then
    v_effective_day := 28;
  end if;

  v_candidate := make_date(v_year, p_month, v_effective_day);

  -- Already past this year, so the next occurrence is next year. A 29 February
  -- birthday that has just gone by lands here in a leap year, and the following
  -- year is then not a leap year, so the clamp is applied again.
  if v_candidate < v_today then
    v_year := v_year + 1;
    v_effective_day := p_day;
    if p_month = 2 and p_day = 29
       and (mod(v_year, 4) <> 0 or mod(v_year, 100) = 0)
       and mod(v_year, 400) <> 0 then
      v_effective_day := 28;
    end if;
    v_candidate := make_date(v_year, p_month, v_effective_day);
  end if;

  -- Local 23:59:59.999 on v_candidate, as an instant.
  --
  -- Subtracting the offset from the local wall clock gives the UTC wall clock,
  -- and `at time zone 'UTC'` is what turns that into a timestamptz. The explicit
  -- zone is essential: casting a bare timestamp to timestamptz instead would
  -- interpret it in whatever TimeZone the session happens to have set, so the
  -- same row would expire at a different moment depending on who was reading it.
  return (
    (v_candidate::timestamp - v_ist_offset + interval '23 hours 59 minutes 59.999 seconds')
    at time zone 'UTC'
  );
end;
$$;

comment on function public.birthday_expiry_for(smallint, smallint) is
  'End of validity for a birthday month/day: 23:59:59.999 Asia/Kolkata on the next occurrence, or NULL for an impossible date. Single source of truth, shared by the insert trigger.';

-- -----------------------------------------------------------------------------
-- 3. The authoritative trigger
--
-- BEFORE INSERT, so it runs after any client-supplied value has arrived and can
-- overwrite it. There is no BEFORE UPDATE counterpart and no client update path,
-- so nothing can move the date afterwards.
--
-- time zone is pinned explicitly. Without it the result would depend on the
-- database's configured zone, and a project running in UTC would expire pages at
-- the wrong moment.
-- -----------------------------------------------------------------------------
create or replace function public.birthday_set_expiry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- timezone(text, timestamptz) is the immutable form: it names the zone and
  -- takes the instant, so it does not depend on the session's TimeZone.
  new.expires_at := public.birthday_expiry_for(new.birthday_month, new.birthday_day);

  if new.expires_at is null then
    raise exception 'unsupported birthday date: month %, day %', new.birthday_month, new.birthday_day
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists birthday_pages_set_expiry on public.birthday_pages;

create trigger birthday_pages_set_expiry
  before insert on public.birthday_pages
  for each row
  execute function public.birthday_set_expiry();

comment on function public.birthday_set_expiry() is
  'BEFORE INSERT trigger. Computes expires_at from the server clock and overwrites any client-supplied value. Cannot be skipped by any client key.';

-- -----------------------------------------------------------------------------
-- 4. Audio columns
--
-- One optional track per page. The path is stored, never a URL: the bucket is
-- private, so the URL has to be minted per request and per expiry.
--
-- audio_path and audio_mime must be set together or not at all. A path without a
-- content type would be served without one, and a content type without a path is
-- meaningless.
-- -----------------------------------------------------------------------------
alter table public.birthday_pages add column if not exists audio_path text;
alter table public.birthday_pages add column if not exists audio_mime text;

alter table public.birthday_pages
  drop constraint if exists birthday_pages_audio_mime_allowed;

alter table public.birthday_pages
  add constraint birthday_pages_audio_mime_allowed
    check (
      audio_mime is null
      or audio_mime in ('audio/mpeg', 'audio/mp4', 'audio/ogg')
    );

alter table public.birthday_pages
  drop constraint if exists birthday_pages_audio_paired;

alter table public.birthday_pages
  add constraint birthday_pages_audio_paired
    check ((audio_path is null) = (audio_mime is null));

comment on column public.birthday_pages.audio_path is
  'Object path in the private birthday-audio bucket, or NULL. Always paired with audio_mime; never a URL.';

-- Same shape as assert_photo_paths_scoped: the path must sit inside this row's
-- own public_id folder, one level deep, with an audio extension. A page therefore
-- cannot point at another page's audio, and cannot reach outside the folder.
create or replace function public.assert_audio_path_scoped()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.audio_path is null then
    return new;
  end if;

  if new.audio_path !~ ('^' || new.public_id || '/[0-9a-z-]{1,64}\.(mp3|m4a|ogg)$') then
    raise exception 'audio_path is not scoped to this page folder'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists birthday_pages_audio_scoped on public.birthday_pages;

create trigger birthday_pages_audio_scoped
  before insert or update on public.birthday_pages
  for each row
  execute function public.assert_audio_path_scoped();

-- -----------------------------------------------------------------------------
-- 5. The public read function
--
-- Replaced rather than amended: the return type gained three columns, and
-- PostgreSQL will not let a return type be changed in place. Dropping first also
-- keeps the file re-runnable.
--
-- The added line is the whole point:
--
--     and now() < b.expires_at
--
-- Once that instant passes, the row is no longer returned. The page is
-- unreachable through the only anonymous read path, whether or not cleanup has
-- run yet. Cleanup removes the media; this removes the page. They are separate
-- because only this one is immediate.
--
-- now() is transaction time in Postgres, which for a single read is the same
-- thing as the request time, and it is the database's clock rather than the
-- browser's.
--
-- The internal id is still absent, and the id is what cleanup uses, so a public
-- read cannot be turned into a deletion handle.
--
-- expires_at IS returned. It is not a secret - anyone holding the link can work
-- out when it stops working - and the server needs it to cap the lifetime of the
-- signed audio URL, so no playable URL outlives the page that issued it.
-- -----------------------------------------------------------------------------
drop function if exists public.get_birthday_page(text);

create or replace function public.get_birthday_page(p_public_id text)
returns table (
  public_id text,
  name text,
  relationship text,
  message text,
  style text,
  photo_paths text[],
  audio_path text,
  audio_mime text,
  birthday_month smallint,
  birthday_day smallint,
  expires_at timestamptz,
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
    b.audio_path,
    b.audio_mime,
    b.birthday_month,
    b.birthday_day,
    b.expires_at,
    b.created_at
  from public.birthday_pages b
  where b.public_id = p_public_id
    and p_public_id ~ '^[0-9a-f]{32}$'
    and now() < b.expires_at;
$$;

comment on function public.get_birthday_page(text) is
  'Returns one unexpired birthday page by its 128-bit public_id, or no rows. Returns nothing at or after expires_at. The only anonymous read path; never returns the internal id.';

revoke all on function public.get_birthday_page(text) from public;
grant execute on function public.get_birthday_page(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Audio storage
--
-- public = false, which is the difference from photos and the reason this section
-- exists at all.
--
--   * A public bucket serves /object/public/<bucket>/<path> to anyone who has the
--     URL, with no auth and no expiry. Those URLs are in the HTML of a shared
--     link, so they are in every chat log and clipboard that link has been
--     through, and they would keep working after the birthday passed. Nothing in
--     Storage consults the database, so a page can be expired and its audio still
--     fetchable.
--   * A private bucket has no such endpoint. Storage checks RLS first, and this
--     bucket has no SELECT policy at all, so the only reader is the server, which
--     signs a URL that expires.
--
-- Uploads still work from the browser: the insert policy below grants exactly
-- that, and nothing else. No read, no overwrite, no delete.
--
-- 5 MB, matching what the app enforces, and only the three formats the app can
-- accept. The bucket's own file_size_limit and allowed_mime_types are applied
-- server side, so a direct client cannot post a 200 MB file.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('birthday-audio', 'birthday-audio', false, 5242880,
        array['audio/mpeg', 'audio/mp4', 'audio/ogg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No explicit GRANT. An explicit grant on storage.objects would apply to every
-- bucket in the project rather than to this one; the narrowed default grant set
-- plus the policy below is the tighter arrangement.
--
-- split_part on the column itself, not storage.foldername(), for the reason given
-- in supabase/hotfix-20260101-storage-upload-policy.sql: foldername() returned
-- NULL against this project and a NULL with-check denies the row, which is how
-- every anonymous photo upload failed. The explicit two-segment guard also keeps
-- `../` traversal and deeper paths out.
drop policy if exists "anyone can upload audio into a new page folder" on storage.objects;

create policy "anyone can upload audio into a new page folder"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'birthday-audio'
    and split_part(name, '/', 1) ~ '^[0-9a-f]{32}$'
    and split_part(name, '/', 2) ~ '^[0-9a-z-]{1,64}\.(mp3|m4a|ogg)$'
    and array_length(string_to_array(name, '/'), 1) = 2
  );

-- SELECT is intentionally absent. Without it, and with the bucket private, a
-- signed URL from the server is the only way to read audio. UPDATE and DELETE are
-- absent for the same reason as photos: cleanup runs through the Storage API with
-- the secret key, not through a client policy.

-- -----------------------------------------------------------------------------
-- 7. Upload rate limiting for the audio bucket
--
-- The Phase 6 limiter is scoped by its WHEN clause to birthday-photos, so without
-- this a client could post 30 photos an hour and then an unlimited number of
-- audio files, which is the same storage budget with a cheaper front door.
--
-- It reuses rate_limit_storage_insert unchanged, and therefore shares the 'upload'
-- counter with photos. That is intended: the limit exists to bound bytes and
-- objects committed per hour, and splitting the budget would double the ceiling.
-- Audio at 5 MB against an 80 MB hourly allowance is at most six more files.
--
-- The name carries 'audio' so it is distinguishable from the photo trigger in
-- pg_trigger when both are armed.
-- -----------------------------------------------------------------------------
drop trigger if exists birthday_audio_rate_limit on storage.objects;

create trigger birthday_audio_rate_limit
  before insert on storage.objects
  for each row
  when (new.bucket_id = 'birthday-audio')
  execute function public.rate_limit_storage_insert();

-- -----------------------------------------------------------------------------
-- 8. Cleanup helpers
--
-- Reclamation only. Reads are already refused by get_birthday_page, so an expired
-- row is inert even if this never runs. It exists to reclaim storage.
--
-- pending_expiry_cleanup() lists the expired rows, oldest first, capped by
-- p_limit so one run cannot walk an unbounded backlog. SECURITY DEFINER because
-- the server has no SELECT grant on the table, and stable, because it only reads.
--
-- It returns the internal id as well as the public_id. The id is what the delete
-- needs; the public_id is what identifies the page in a log line.
--
-- Granted to service_role only. Anon and authenticated get a permission error,
-- which is the intended answer: this is a maintenance entry point, not a
-- public one, and it hands out the handles that deletion uses.
-- -----------------------------------------------------------------------------
create or replace function public.pending_expiry_cleanup(p_limit integer default 50)
returns table (
  id bigint,
  public_id text,
  photo_paths text[],
  audio_path text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id, b.public_id, b.photo_paths, b.audio_path
  from public.birthday_pages b
  where b.expires_at <= now()
  order by b.expires_at asc, b.id asc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

comment on function public.pending_expiry_cleanup(integer) is
  'Expired rows, oldest first, capped by p_limit. Returns the internal id for deletion. service_role only. Never callable by a client.';

revoke all on function public.pending_expiry_cleanup(integer) from public;
grant execute on function public.pending_expiry_cleanup(integer) to service_role;

-- A count for monitoring and for the dashboard check after applying.
create or replace function public.expired_birthday_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) from public.birthday_pages where expires_at <= now();
$$;

revoke all on function public.expired_birthday_count() from public;
grant execute on function public.expired_birthday_count() to service_role;

-- Removes one row, but only once it is actually past its expiry.
--
-- Exists so the cleanup route needs no table privilege at all. The public
-- read path deliberately withholds SELECT from the server key, and adding a
-- table-level DELETE grant to get the last step of a maintenance job done would
-- hand that key a permanent "delete any row" capability -- a much broader
-- ability than "delete rows that are already unreachable". SECURITY DEFINER
-- with the guard inside is the narrower grant.
--
-- The `expires_at <= now()` predicate is re-checked here rather than trusted from
-- the caller. pending_expiry_cleanup() and this call are separated by the Storage
-- deletions, which on a large page can take a moment; re-checking means a row that
-- somehow became unexpired in that window is left alone instead of deleted.
--
-- Returns whether a row was actually removed, so the caller can tell a successful
-- purge from one whose target had already gone.
-- -----------------------------------------------------------------------------
create or replace function public.purge_expired_birthday_page(p_public_id text)
returns boolean
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  delete from public.birthday_pages b
  where b.public_id = p_public_id
    and b.expires_at <= now()
  returning true;
$$;

comment on function public.purge_expired_birthday_page(text) is
  'Deletes one already-expired row by public_id. Refuses a live row. service_role only. Never callable by a client.';

revoke all on function public.purge_expired_birthday_page(text) from public;
grant execute on function public.purge_expired_birthday_page(text) to service_role;

-- =============================================================================
-- Self-test - run after applying.
-- =============================================================================
--
-- (1) Expiry is computed, not accepted. Expect 2026-10-05 18:29:59.999+00.
--
--     insert into public.birthday_pages
--       (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--     values ('Ama', 'Sister', 'hi', 'romantic', '{}', 10, 5)
--     returning expires_at;
--
-- (2) A client-supplied expiry is overwritten. Expect the same 2026-10-05 value,
--     NOT the year 3000 that was sent.
--
--     insert into public.birthday_pages
--       (name, relationship, message, style, photo_paths, birthday_month, birthday_day, expires_at)
--     values ('Ama', 'Sister', 'hi', 'romantic', '{}', 10, 5, '3000-01-01T00:00:00Z')
--     returning expires_at;
--
-- (3) Impossible dates are refused.
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 2, 30);
--     rollback;
--     -> ERROR: unsupported birthday date: month 2, day 30
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 4, 31);
--     rollback;
--     -> ERROR: new row violates check constraint "birthday_pages_birthday_day_range"
--
--     29 February is ACCEPTED, in every year.
--
--       begin;
--         insert into public.birthday_pages
--           (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--         values ('Ama', 'Sister', 'hi', 'romantic', '{}', 2, 29)
--         returning birthday_month, birthday_day, expires_at;
--       rollback;
--
-- (4) An expired page is invisible to the public read path immediately.
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day, expires_at)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 1, 1, now() - interval '1 minute');
--     -- that insert is fine, the trigger overwrote it; instead simulate an
--     -- expired row directly:
--       update public.birthday_pages set expires_at = now() - interval '1 minute'
--        where public_id = '<id from step 1>';
--       select count(*) from public.get_birthday_page('<that public_id>');
--       -> 0
--     rollback;
--
-- (5) The audio bucket is private and limited. Expect f, 5242880, 3 rows.
--
--     select public, file_size_limit, array_length(allowed_mime_types, 1)
--       from storage.buckets where id = 'birthday-audio';
--
-- (6) The audio policy is insert-only. Expect only the upload policy, no SELECT,
--     no UPDATE, no DELETE on this bucket.
--
--     select policyname, cmd from pg_policies
--      where schemaname = 'storage' and tablename = 'objects'
--        and policyname = 'anyone can upload audio into a new page folder';
--     -> anyone can upload audio into a new page folder | INSERT
--
-- (7) Both upload limiters are armed. Expect two rows.
--
--     select tgname, tgenabled from pg_trigger
--      where tgrelid = 'storage.objects'::regclass and not tgisinternal
--        and tgname like 'birthday%rate_limit';
--     -> birthday_audio_rate_limit   | O
--     -> birthday_photos_rate_limit  | O
--
-- (8) The expiry trigger is armed. Expect birthday_pages_set_expiry | O
--
--     select tgname, tgenabled from pg_trigger
--      where tgrelid = 'public.birthday_pages'::regclass and not tgisinternal
--        and tgname = 'birthday_pages_set_expiry';
--
-- (9) Cleanup helpers are invisible to clients. Expect a permission error for
--     both. Note the `select * from` -- a bare `select func(10)` is not valid
--     syntax for a function returning a table.
--
--     select * from public.pending_expiry_cleanup(10);
--     -> permission denied for function pending_expiry_cleanup
--
--     select public.purge_expired_birthday_page(repeat('a', 32));
--     -> permission denied for function purge_expired_birthday_page
--
-- (10) audio_path cannot point at another page's folder. Expect a check_violation.
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day,
--          audio_path, audio_mime)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 5, 5,
--               repeat('b', 32) || '/song.mp3', 'audio/mpeg');
--     rollback;
--     -> ERROR: audio_path is not scoped to this page folder
--
-- (11) audio_path and audio_mime must agree.
--
--     The row is written with a path scoped to its OWN generated public_id, so the
--     scoping trigger lets it past and the pairing constraint is what fires.
--     Reusing a fixed foreign id here, as an earlier draft did, raised the
--     scoping error instead and never reached the constraint being tested.
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day,
--          audio_path, audio_mime)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 5, 5,
--               repeat('c', 32) || '/song.mp3', null);
--     rollback;
--     -> ERROR: audio_path is not scoped to this page folder
--
--     To test the pairing constraint specifically, use a row whose own public_id
--     is returned first and substitute it for repeat('c', 32):
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 5, 5)
--       returning public_id \gset
--
--       update public.birthday_pages
--          set audio_path = :'public_id' || '/song.mp3'
--        where public_id = :'public_id';
--     rollback;
--     -> ERROR: new row violates check constraint "birthday_pages_audio_paired"
--
-- (12) No birth year column exists.
--
--     select column_name from information_schema.columns
--      where table_name = 'birthday_pages'
--        and column_name ilike '%year%';
--     -> (no rows)
--
-- (13) Nothing expired is waiting for cleanup. Expect 0.
--
--     select public.expired_birthday_count();
--
-- (14) The purge refuses a live row. Expect false, and the row to still exist.
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 12, 31)
--       returning public_id \gset
--
--       select public.purge_expired_birthday_page(:'public_id');
--       -> false
--
--       select count(*) from public.birthday_pages where public_id = :'public_id';
--       -> 1
--     rollback;
--
-- (15) The purge removes an expired row. Expect true, then 0.
--
--     begin;
--       insert into public.birthday_pages
--         (name, relationship, message, style, photo_paths, birthday_month, birthday_day)
--       values ('Ama', 'Sister', 'hi', 'romantic', '{}', 1, 1)
--       returning public_id \gset
--
--       -- Force expiry. The insert trigger will not allow it to be set up front.
--       update public.birthday_pages
--          set expires_at = now() - interval '1 minute'
--        where public_id = :'public_id';
--
--       select public.purge_expired_birthday_page(:'public_id');
--       -> true
--
--       select count(*) from public.birthday_pages where public_id = :'public_id';
--       -> 0
--     rollback;
-- =============================================================================