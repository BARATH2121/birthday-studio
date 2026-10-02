# Phase 5 — Supabase Setup

Everything needed to run the save-and-share flow against a real Supabase project,
and the reasoning behind the non-obvious choices. Phase 5 has no accounts and no
server-side secret requirement, so the shortest correct path is about ten
minutes of clicking plus one migration.

---

## 1. What you need

- A Supabase project (the free tier is sufficient).
- The project URL and the **new-style** API keys. The older `anon` and
  `service_role` keys are deprecated and this codebase deliberately does not
  read them.
- The Supabase CLI, if you prefer `db push` over pasting SQL into the dashboard.

---

## 2. Apply the migration

The first migration is
`supabase/migrations/20260930120000_birthday_pages.sql`. It creates:

| Object | Purpose |
| --- | --- |
| `public.birthday_pages` | The page row. Insert-only for clients. |
| `public.get_birthday_page(text)` | The only anonymous read path. |
| `public.touch_updated_at()` | Trigger helper. |
| `public.assert_photo_paths_scoped()` | Trigger that forces every `photo_paths` entry into the row's own folder. |
| `storage.buckets` row `birthday-photos` | Public image bucket, 10 MB cap, JPEG/PNG/WebP only. |
| 1 RLS policy on `birthday_pages` | `for insert to anon, authenticated`. |
| 1 RLS policy on `storage.objects` | `for insert to anon, authenticated`, folder must be a 32-hex page id. |

Phase 6 adds two more, which must be applied **after** this one:

| Order | File | Adds |
| --- | --- | --- |
| 2 | `20261001120000_rate_limiting.sql` | upload throttling |
| 3 | `20261002120000_birthday_expiry_audio.sql` | required birthday date, page expiry, the private `birthday-audio` bucket, expired-page cleanup |

`birthday-audio` is created by the migration, so there is nothing to add by hand in
the dashboard. If you are skipping Phase 6, stop after this file — but note the
app now **requires** a birthday month and day, which only migration 3 adds.

### With the CLI

```bash
supabase init                              # once, creates supabase/config.toml
supabase link --project-ref <project-ref>
supabase db push --dry-run                 # read the plan before applying
supabase db push
```

### Without the CLI

Dashboard → **SQL Editor** → paste the migration file → **Run**. It is
idempotent (`if not exists`, `create or replace`, `on conflict do update`,
`drop trigger if exists`, `drop policy if exists`), so re-running it is safe.

Note that the Dashboard runs a script as a single implicit transaction: if any
statement fails, the whole thing rolls back and leaves nothing behind, so a
failed run can always simply be re-run. `create policy` has no
`if not exists` form, which is why both policies are explicitly dropped first.

### Verify

```bash
supabase migration list
supabase db lint --linked
supabase db advisors --linked
```

`advisors` will still report the "table without RLS" style informational notes
for `storage.*` internals, and may flag the `insert ... with check (true)`
policy. Both are expected and are explained in section 5.

---

## 3. Configure the app

```bash
cp .env.example .env.local          # macOS / Linux
Copy-Item .env.example .env.local   # PowerShell
```

Fill in:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | e.g. `https://abcdefghijklmnop.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_...`. Safe to ship; RLS is the control. |
| `SUPABASE_SECRET_KEY` | optional | `sb_secret_...`. Used only by orphan cleanup. |

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time. Never
put a secret key in one of them.

If `SUPABASE_SECRET_KEY` is empty the app still works end to end — you just lose
immediate cleanup of photos from saves that fail midway, and those files are
reclaimed by the Storage lifecycle rule in section 6 instead.

Then:

```bash
npm run dev      # http://localhost:3000
```

> Use `localhost`, not `127.0.0.1`. In dev, Next 16 blocks cross-origin dev
> requests, and the `127.0.0.1` origin is not in the allow-list, so the page
> serves but never hydrates and every click silently does nothing.

---

## 4. Smoke test

1. `npm run dev`, open `http://localhost:3000/create`.
2. Fill in details, add two photos, pick a style, press Generate.
3. Copy the link. It must look like
   `http://localhost:3000/birthday/<32 lowercase hex chars>`.
4. Open the link in a private window. The page renders.
5. Visit `http://localhost:3000/birthday/<32 random hex chars>` — not-found UI.
6. Check the row landed once:
   ```sql
   select public_id, name, style, photo_paths from public.birthday_pages
   order by created_at desc limit 1;
   ```

---

## 5. Why the permissions look unusual

**`anon` has INSERT on the table but no SELECT.** Postgres checks grants before
RLS, so a `for select using (true)` policy would let anyone run
`GET /rest/v1/birthday_pages?select=*` and dump every page in one request. RLS
cannot help, because it is evaluated per row and every row passes. Reads
therefore go exclusively through `get_birthday_page(public_id)`, a
`security definer` function pinned to `set search_path = public, pg_temp` that
returns at most the one row matching one exact id, and never returns the
internal `id`.

This is why application code must never call `.insert(...).select(...)`:
PostgREST's `RETURNING` clause needs SELECT privilege and would fail. The save
path inserts without `RETURNING` and uses the id it generated itself.

**No UPDATE or DELETE policy, and no grant either.** A shared link is
write-once from the browser's point of view. Nothing a client can do modifies or
removes a page, including a page the client itself created. Removing a page is
an operator action in the SQL editor.

**Photo paths are enforced by a trigger, not a convention.** A hostile client
could otherwise INSERT a row whose `photo_paths` pointed into another birthday's
folder and render someone else's photos. `assert_photo_paths_scoped` rejects
any entry that is not `<this row's public_id>/<file>`.

**Anonymous INSERT is accepted, with a named limitation.** There are no
accounts, so anyone can create rows. An INSERT can only add a row — it cannot
read, deface, or delete an existing one — and every field is constrained
(lengths, enums, ≤20 photos, path scoping), and `public_id` is unique so a
collision fails rather than overwrites. What this does *not* stop is a determined
client creating junk rows. Section 6 is the mitigation.

---

## 6. Abuse and cost mitigations

**Phase 6 has since added database-enforced rate limiting and orphan cleanup —
see `docs/phase6-abuse-and-cleanup.md`.** This section is left as written for
Phase 5, which had no rate limit at all; treat the "no built-in rate limit"
paragraph below as historical.

Phase 5 shipped with these mitigations still open:

- **Edge Function rate limiting.** Move the create call behind a Supabase Edge
  Function that checks the caller's IP against a rate limit. This is the only
  mitigation that actually constrains volume; nothing in the current design can
  distinguish one anonymous creator from another.
- **Storage lifecycle rule.** Storage → **Settings → Lifecycle** → expire objects
  in `birthday-photos` **and** `birthday-audio` after N days, or add a scheduled
  job that deletes objects whose folder has no matching `birthday_pages` row.
  This reclaims the cost of photos and tracks uploaded by saves that never
  completed.
- **CAPTCHA** on the Generate button before the insert.
- **Require sign-in to create.** Changes the product, not just the plumbing;
  revisit if anonymous creation is not load-bearing.

Phase 6 took the first item as a `BEFORE INSERT` trigger instead of an Edge
Function, because the browser holds the publishable key and could bypass any
check that lives outside Postgres. **The Storage lifecycle rule is still the
recommended backstop** and is not replaced by the Phase 6 sweeper, which only
runs when someone is actively saving.

---

## 7. The public photo bucket is a deliberate trade-off

`birthday-photos` is `public = true`. A birthday page is meant to be opened on a
device you do not control, and the photos are part of that page. A signed-URL
design would need per-view minting, an expiry lifecycle, a refresh path, and CDN
cache invalidation — real complexity, and no privacy gain on a page that is
public by definition.

What it costs: anyone who obtains a photo URL can fetch that image. URLs are
namespaced under a 128-bit random folder and are only published to people who
already hold the page link, but the Generate screen copy says so explicitly
rather than hiding it.

If a later phase needs private photos: set `public = false` on the bucket, add a
`select` policy keyed to a claim, and mint signed URLs in the public page's
Server Component. The app stores only `photo_paths`, so that switch needs no
schema change.

---

## 8. Legacy key names

This codebase reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SECRET_KEY` only. If you are migrating from an older checkout that used
`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, rename the
variables in `.env.local`; the old names are never read and you will get
"Supabase is not configured" until you do.
