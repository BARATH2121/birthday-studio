-- =============================================================================
-- Phase 6 — Abuse protection
-- Database-enforced rate limiting for row creation and photo uploads.
--
-- Apply with the Supabase CLI:
--   supabase db push
-- Or paste into the Dashboard SQL Editor, which runs the whole file as one
-- transaction.
-- Verify with the self-test at the bottom of this file.
--
-- -----------------------------------------------------------------------------
-- WHY THIS IS A DATABASE TRIGGER AND NOT AN EDGE FUNCTION, A CAPTCHA, OR A
-- SERVER ACTION
--
-- Phase 5 left the write path entirely in the browser: the page holds the
-- publishable key and calls PostgREST and Storage directly. Anything enforced in
-- Next.js therefore sits in front of a door that is not the one being used.
--
--   * A server action is advisory. The browser can simply skip it and post
--     straight to /rest/v1/birthday_pages.
--   * An Edge Function is the same story plus a paid request quota, which this
--     project does not have.
--   * A CAPTCHA needs a vendor, and vendors need money.
--
-- A BEFORE INSERT trigger is the only placement that is actually unbypassable
-- with the keys the browser already holds: the request has to reach Postgres,
-- and the check runs there. It is free, it is part of Postgres, and it cannot be
-- skipped by any client.
--
-- This STRENGTHENS the Phase 5 rules. It adds no grant, no policy and no code
-- path that an anon client did not already have.
--
-- -----------------------------------------------------------------------------
-- THE COUNTER ROLLBACK PROBLEM, AND WHY THE CHECK COMES FIRST
--
-- The obvious implementation is "increment the counter, and raise if it is now
-- over the limit". That does not work: raising inside a BEFORE trigger aborts
-- the transaction, which rolls back the increment along with it. An attacker
-- blocked once would find the counter still below the limit, so retrying would
-- let them through forever.
--
-- So this file is written the other way round:
--
--   1. read the counter for the current window;
--   2. if it is already at the limit, raise — nothing was written, and the
--      counter was already full, so the block persists for the whole window;
--   3. otherwise increment and let the row through.
--
-- A blocked request never increments, but that does not matter: the counter is
-- already at the limit, so every retry during the window is blocked too. The
-- limit bites, and it holds.
--
-- A row that then fails a CHECK constraint also rolls the increment back, which
-- is the desired behaviour: only pages that were actually created count against
-- the quota.
--
-- -----------------------------------------------------------------------------
-- CLIENT IDENTITY
--
-- There are no accounts, so the only available identity is the client IP,
-- read from the X-Forwarded-For header that PostgREST exposes through the
-- `request.headers` setting.
--
-- That header is not guaranteed to exist. If it is missing, the resolved key is
-- NULL and the request falls into a single shared "unknown" bucket with a much
-- higher allowance, rather than a strict per-IP one. That is the safe direction
-- to fail: an over-generous shared bucket degrades to "the site still works but
-- abuse is still bounded", whereas a strict per-IP bucket with no key would deny
-- everyone at once and take the site down.
--
-- Mobile carrier-grade NAT means many unrelated people can share one IP, so the
-- per-IP allowance is set generously (30 uploads and 20 pages an hour). It is
-- there to stop bursts and scripts, not to enforce a per-person quota.
--
-- public.rate_limit_probe() reports what PostgREST is actually forwarding, so
-- this can be verified on the live project instead of assumed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Counter table
--
-- Deliberately unreachable from any client: RLS on, no policies, and every
-- privilege revoked. The only writer is the SECURITY DEFINER function in
-- section 2, so a client cannot read the counters to learn how close it is to a
-- limit, and cannot zero one out.
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_counters (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  bytes bigint not null default 0,
  constraint rate_limit_counters_pk primary key (bucket, key, window_start)
);

comment on table public.rate_limit_counters is
  'Fixed-window rate-limit counters for row creation and photo uploads. Server-only: RLS enabled, no policies, all client privileges revoked.';

alter table public.rate_limit_counters enable row level security;

revoke all on table public.rate_limit_counters from anon, authenticated;
revoke all on table public.rate_limit_counters from public;

-- RLS is enabled here even though privilege revocation alone would already
-- deny every client, because the two controls fail independently: if a future
-- change ever grants a privilege by mistake, the missing policy still blocks
-- reads and writes.
--
-- This does not lock out the limiter's own writes. Per PostgreSQL's rules a
-- table owner is exempt from its own table's RLS unless the table is put under
-- FORCE ROW LEVEL SECURITY, and the SECURITY DEFINER functions below run as the
-- owner. That exemption is what makes this arrangement work, and it is a
-- property of PostgreSQL rather than of any Supabase role setting.
--
-- CONSEQUENCE: do not add `force row level security` to this table. Doing so
-- would make the owner subject to RLS with no policy to satisfy, and every
-- insert and every upload would fail with a permission error.

-- -----------------------------------------------------------------------------
-- 2. Client identity
--
-- SECURITY DEFINER so it can be read from inside the trigger functions, which
-- run as their owner. It reveals nothing sensitive — it returns the caller's
-- own IP — and it is revoked from every client role anyway.
--
-- The plpgsql wrapper is not decoration. current_setting('request.headers')
-- can be NULL, empty, or non-JSON depending on how the request arrived, and
-- `''::json` is a hard cast error that would turn a malformed header into a
-- failed insert for every user. The exception block turns all of that into NULL,
-- i.e. "no key", which the caller already knows how to handle.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_client_key()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  raw text;
  headers json;
  forwarded text;
begin
  raw := current_setting('request.headers', true);

  if raw is null or raw = '' then
    return null;
  end if;

  headers := raw::json;

  -- X-Forwarded-For is a comma-separated chain, client first. Only the first
  -- entry is the real caller; the rest are proxies.
  forwarded := coalesce(headers ->> 'x-forwarded-for', headers ->> 'x-real-ip');

  if forwarded is null then
    return null;
  end if;

  return nullif(split_part(forwarded, ',', 1), '');

exception
  when others then
    return null;
end;
$$;

revoke all on function public.rate_limit_client_key() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. The limiter
--
-- p_key_override lets one caller be charged to a named bucket instead of its IP.
-- That is how the project-wide ceiling is expressed: the literal key 'global'
-- gets its own counter that every client shares, and 'unknown' is the shared
-- fallback for requests with no IP.
--
-- p_max_bytes is checked against the window total and incremented by p_bytes.
-- Counting bytes rather than only objects is what actually protects the free
-- tier: a page can hold 20 photos of 10 MB, so an object count alone would allow
-- 200 MB per page and the storage budget would be gone in five pages.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_consume(
  p_bucket text,
  p_max_hits integer,
  p_window_seconds integer,
  p_max_bytes bigint default null,
  p_bytes bigint default 0,
  p_key_override text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_window timestamptz;
  v_hits integer;
  v_bytes bigint;
  v_added bigint;
begin
  v_key := coalesce(p_key_override, public.rate_limit_client_key(), 'unknown');
  v_added := greatest(coalesce(p_bytes, 0), 0);

  -- Fixed window aligned to the epoch, so every client sees the same boundaries
  -- and the window length is exact rather than "since my first request".
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Serialise concurrent requests for this bucket. Without it, ten simultaneous
  -- uploads would all read hits = 0, all pass the check, and all increment: the
  -- limit would be ten times too generous exactly when it is most needed.
  -- Transaction-scoped, so it is released automatically on commit or rollback.
  perform pg_advisory_xact_lock(hashtext(p_bucket || '|' || v_key));

  select hits, bytes
    into v_hits, v_bytes
    from public.rate_limit_counters
   where bucket = p_bucket and key = v_key and window_start = v_window;

  v_hits := coalesce(v_hits, 0);
  v_bytes := coalesce(v_bytes, 0);

  -- The limit is enforced by refusing a bucket that is already full. No write
  -- has happened yet, so raising here leaves the counter untouched and the block
  -- survives for the rest of the window. See the rollback note at the top.
  if v_hits >= p_max_hits then
    raise exception 'birthday-studio rate limit reached for % (too many requests, try again later)', p_bucket
      using errcode = 'BSL01';
  end if;

  if p_max_bytes is not null and (v_bytes + v_added) > p_max_bytes then
    raise exception 'birthday-studio rate limit reached for % (upload volume, try again later)', p_bucket
      using errcode = 'BSL01';
  end if;

  insert into public.rate_limit_counters as c (bucket, key, window_start, hits, bytes)
  values (p_bucket, v_key, v_window, 1, v_added)
  on conflict (bucket, key, window_start)
    do update set hits = c.hits + 1,
                  bytes = c.bytes + excluded.bytes;

  -- Bound the table. Counters are one row per bucket per window, so a busy
  -- project accumulates a few hundred rows an hour; anything much larger means
  -- pruning has been skipped. The count is over a small, indexed table.
  if (select count(*) from public.rate_limit_counters) > 5000 then
    delete from public.rate_limit_counters where window_start < now() - interval '1 day';
  end if;
end;
$$;

revoke all on function public.rate_limit_consume(text, integer, integer, bigint, bigint, text)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Row creation limiter
--
-- Three allowances, because there are two different failure modes to avoid and
-- they pull in opposite directions:
--
--   * per client    20/hour  — stops bursts and scripts. Generous because of CGNAT.
--   * 'unknown'    200/hour  — shared bucket used only when no IP is available,
--                              so a missing header degrades to a looser site-wide
--                              cap instead of a total outage.
--   * 'global'    2,000/hour  — the hard ceiling on rows, independent of how well
--                              client identification works.
--
-- Deliberately does not widen anything: it runs before the existing CHECK
-- constraints and the RLS policy, and adds no privilege.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_row_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
begin
  v_key := public.rate_limit_client_key();

  if v_key is null then
    perform public.rate_limit_consume('row', 200, 3600, null, 0, 'unknown');
  else
    perform public.rate_limit_consume('row', 20, 3600, null, 0, null);
  end if;

  perform public.rate_limit_consume('row', 2000, 3600, null, 0, 'global');

  return new;
end;
$$;

drop trigger if exists birthday_pages_rate_limit on public.birthday_pages;

create trigger birthday_pages_rate_limit
  before insert on public.birthday_pages
  for each row
  execute function public.rate_limit_row_insert();

-- -----------------------------------------------------------------------------
-- 5. Upload limiter
--
-- The upload path is the expensive one: twenty photos at ten megabytes each is
-- two hundred megabytes committed before any row exists. Storage buckets have
-- no quota on the free tier — reaching the project limit pauses the project
-- rather than billing it — so this limit is what keeps the free tier usable.
--
-- Allowance is expressed in both objects and bytes, because they fail
-- differently: a script uploading 1x1 images burns the object count while
-- costing nothing, and a script uploading 10 MB files burns the bytes while
-- costing one object each.
--
--   * per client  30 objects / 80 MB per hour
--   * 'unknown' 150 objects / 400 MB per hour  (only when no IP is available)
--   * 'global'   500 objects / 512 MB per hour
--
-- Scoped to this bucket by the WHEN clause, so no other bucket in the project
-- is affected.
--
-- RLS on storage.objects rejects disallowed paths with an error, which rolls
-- this trigger's counter write back — so requests that Storage would refuse
-- anyway do not consume anyone's quota, and the limit cannot be griefed with
-- junk paths.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_storage_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_bytes bigint := 0;
begin
  -- storage.objects carries the upload size in metadata. A missing or malformed
  -- value degrades to byte-count-only limiting rather than failing the upload.
  if new.metadata is not null then
    begin
      v_bytes := (new.metadata ->> 'size')::bigint;
    exception when others then
      v_bytes := 0;
    end;
  end if;

  v_key := public.rate_limit_client_key();

  if v_key is null then
    perform public.rate_limit_consume('upload', 150, 3600, 419430400, v_bytes, 'unknown');
  else
    perform public.rate_limit_consume('upload', 30, 3600, 83886080, v_bytes, null);
  end if;

  perform public.rate_limit_consume('upload', 500, 3600, 536870912, v_bytes, 'global');

  return new;
end;
$$;

drop trigger if exists birthday_photos_rate_limit on storage.objects;

create trigger birthday_photos_rate_limit
  before insert on storage.objects
  for each row
  when (new.bucket_id = 'birthday-photos')
  execute function public.rate_limit_storage_insert();

-- -----------------------------------------------------------------------------
-- 6. Message validation tightened
--
-- The Phase 5 constraint counted characters on the raw value, so a message of
-- three spaces satisfied it. The application trims before inserting and so never
-- produced one, but a direct client could, leaving a row that renders as
-- not-found. btrim() closes that. This tightens the constraint; it cannot
-- invalidate anything the app was willing to write.
-- -----------------------------------------------------------------------------
alter table public.birthday_pages drop constraint if exists birthday_pages_message_length;

alter table public.birthday_pages
  add constraint birthday_pages_message_length
  check (char_length(btrim(message)) between 1 and 500);

-- -----------------------------------------------------------------------------
-- 6b. Control and invisible characters refused by the database as well
--
-- The application already rejects these in `validateForGeneration`, but that
-- check lives in the browser, and the browser is not the authority: anyone can
-- post straight to /rest/v1/birthday_pages with the publishable key and a row
-- containing a NUL or a newline would be accepted by the database. Only the
-- database can make this unbypassable, so the same rule is expressed here.
--
-- Character classes use \uXXXX escapes, which PostgreSQL documents as exactly
-- four hexadecimal digits, so no escape here is ambiguous.
--
--   \u0000-\u001f  C0 controls
--   \u007f-\u009f  DEL and the C1 range
--   \u00a0         no-break space
--   \u2028 \u2029  Unicode line and paragraph separators
--   \u202f         narrow no-break space
--   \ufeff         byte-order mark / zero-width no-break space
--
-- A name gets no exceptions. A message keeps \u0009 (tab), \u000a (line feed)
-- and \u000d (carriage return), because people write birthday messages with line
-- breaks and \n is what they type; those three are the only control characters
-- the app's `hasForbiddenControl(message, true)` permits either.
--
-- The invisible characters are refused because they are a spoofing surface, not
-- a rendering one: a name containing a no-break space is not equal to the name
-- it appears to be, and neither is one containing a zero-width character.
--
-- NOTE: adding a CHECK validates the rows already present. The project was
-- verified to hold 0 rows before this file was authored, so this cannot fail on
-- existing data. If that is ever untrue, the statement below will report the
-- offending rows instead of silently rewriting anything.
-- -----------------------------------------------------------------------------
alter table public.birthday_pages drop constraint if exists birthday_pages_name_characters;

alter table public.birthday_pages
  add constraint birthday_pages_name_characters
  check (name !~ '[\u0000-\u001f\u007f-\u009f\u00a0\u2028\u2029\u202f\ufeff]');

alter table public.birthday_pages drop constraint if exists birthday_pages_message_characters;

alter table public.birthday_pages
  add constraint birthday_pages_message_characters
  check (message !~ '[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00a0\u2028\u2029\u202f\ufeff]');

-- -----------------------------------------------------------------------------
-- 7. Verification helper
--
-- Reports what PostgREST is actually forwarding so the client-identity story can
-- be checked on the live project instead of assumed. Revoked from anon and
-- authenticated; reachable only with the secret key.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_probe()
returns table (client_key text, headers_present boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  raw text;
begin
  raw := current_setting('request.headers', true);
  return query select public.rate_limit_client_key(), (raw is not null and raw <> '');
end;
$$;

revoke all on function public.rate_limit_probe() from public, anon, authenticated;
grant execute on function public.rate_limit_probe() to service_role;

-- =============================================================================
-- Self-test — run after applying. Expected: one row, one row, two rows.
-- =============================================================================

-- (1) Client identity is actually available to the limiter.
--
--   select * from public.rate_limit_probe();
--
--   client_key of a real client IP, headers_present = true
--      -> per-client limiting is active.
--   client_key NULL, headers_present = false
--      -> the shared 'unknown' bucket is in use. Still rate limited, just not
--         per client. Fine to ship; just know which one you have.
--
-- (2) The limiter is invisible to anonymous clients.
--
--   select count(*) from public.rate_limit_counters;
--   -> permission denied for table rate_limit_counters
--
-- (3) The row limiter is armed.
--
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'public.birthday_pages'::regclass and not tgisinternal;
--   -> birthday_pages_rate_limit | O
--
-- (4) The upload limiter is armed.
--
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'storage.objects'::regclass and not tgisinternal;
--   -> birthday_photos_rate_limit | O
--
-- (5) The Storage policy is unchanged.
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname = 'anyone can upload photos into a new page folder';
--   -> anyone can upload photos into a new page folder | INSERT
--
-- (6) RLS on the counters table is still on.
--
--   select relrowsecurity from pg_class where oid = 'public.rate_limit_counters'::regclass;
--   -> t
--
-- (7) The tightened message rule and the new character rules are armed.
--
--   select conname from pg_constraint
--    where conrelid = 'public.birthday_pages'::regclass
--      and conname in ('birthday_pages_message_length',
--                      'birthday_pages_name_characters',
--                      'birthday_pages_message_characters')
--    order by conname;
--   -> birthday_pages_message_characters
--      birthday_pages_message_length
--      birthday_pages_name_characters
--
-- (8) The character rules reject what the application rejects, and still allow a
--     line break in a message.
--
--   Run inside a transaction and roll back, so no page is created, no quota is
--   spent, and the counter table is left alone.
--
--   begin;
--
--   -- refused: NUL inside the name
--   insert into public.birthday_pages (public_id, name, relationship, message, style, photo_paths)
--   values (repeat('a', 32), 'Ama' || chr(0) || 'Lee', 'Sister', 'hi', 'romantic', '{}');
--   -> ERROR: new row violates check constraint "birthday_pages_name_characters"
--
--   rollback;
--
--   begin;
--
--   -- refused: a message of nothing but spaces
--   insert into public.birthday_pages (public_id, name, relationship, message, style, photo_paths)
--   values (repeat('a', 32), 'Ama', 'Sister', '   ', 'romantic', '{}');
--   -> ERROR: new row violates check constraint "birthday_pages_message_length"
--
--   rollback;
--
--   begin;
--
--   -- accepted: a two-line message is normal, not an attack
--   insert into public.birthday_pages (public_id, name, relationship, message, style, photo_paths)
--   values (repeat('a', 32), 'Ama', 'Sister', 'line one' || chr(10) || 'line two', 'romantic', '{}');
--   -> INSERT 0 1
--
--   rollback;
-- =============================================================================