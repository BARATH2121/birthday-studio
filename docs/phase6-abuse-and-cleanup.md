# Phase 6 — Abuse Protection, Orphan Cleanup, Expiry and Audio

Phase 5 left two known gaps: anyone could create unlimited rows, and photos
uploaded by a save that never finished stayed in the bucket forever. This phase
closes the first with database-enforced rate limiting and the second with bounded
orphan cleanup.

Three things were added on top of that original scope, because they depend on the
same migration and the same cleanup machinery:

- the birthday **month and day are now required**, and every page expires
  automatically on the next occurrence of that date (section 6);
- an **optional private audio track** can be attached to a page (section 7);
- **expired pages reclaim their own Storage** on a schedule, optionally
  (section 8).

Only the Create and public birthday screens change. Home is untouched, and no
part of the later 3D redesign is started here.

---

## 1. Apply the migration

```bash
supabase db push --dry-run
supabase db push
```

Or Dashboard → **SQL Editor** → paste each file in `supabase/migrations/` in
filename order → **Run**. There are two:

| Order | File | Adds |
| --- | --- | --- |
| 1 | `20261001120000_rate_limiting.sql` | upload throttling |
| 2 | `20261002120000_birthday_expiry_audio.sql` | birthday date, expiry, audio |

Like Phase 5, the Dashboard runs each file as one transaction, so a failure leaves
nothing behind and the file can simply be re-run.

Order matters: the second file re-uses `rate_limit_consume` from the first, so
applying it alone will fail.

### Verify

The file ends with a self-test. Run it after applying:

```sql
-- Expected: three rows — 2 with key 'unknown', 1 with key 'global'.
select bucket, key, hits, bytes
from public.rate_limit_counters
order by bucket, key;
```

Then confirm PostgREST is actually forwarding a client address, because the
per-IP bucket depends on it:

```sql
select public.rate_limit_probe();
```

If that returns `NULL`, Supabase is not forwarding `X-Forwarded-For` on your
project and **every visitor shares the `unknown` bucket**. The site keeps
working; the per-IP allowance is what stops applying. Set
`Settings → API → Extra Headers` or enable `request.headers` for PostgREST if you
want the tighter limits.

Nothing else in the app needs reconfiguring. `SUPABASE_SECRET_KEY` stays
optional — see section 4.

---

## 2. What the migration creates

| Object | Purpose |
| --- | --- |
| `public.rate_limit_counters` | Fixed-window counters. RLS enabled, all grants revoked. |
| `public.rate_limit_client_key()` | Resolves the caller to an IP, or `NULL`. |
| `public.rate_limit_consume(...)` | `SECURITY DEFINER` check-then-increment. |
| `public.rate_limit_row_insert()` | `BEFORE INSERT` on `birthday_pages`. |
| `public.rate_limit_storage_insert()` | `BEFORE INSERT` on `storage.objects`. |

The second migration adds `birthday_month`, `birthday_day`, `expires_at`,
`audio_path`, `audio_mime`, the `birthday-audio` bucket, the SQL functions
`birthday_expiry_for`, `birthday_set_expiry`, `assert_audio_path_scoped`,
`pending_expiry_cleanup`, `expired_birthday_count` and
`purge_expired_birthday_page`, and the triggers `birthday_pages_set_expiry`,
`birthday_pages_audio_scoped` and `birthday_audio_rate_limit`. Sections 6–8
cover those.

### Limits

| Bucket | Pages | Photo objects | Photo bytes |
| --- | --- | --- | --- |
| Per client IP, per hour | 20 | 30 | 80 MB |
| Unknown client, per hour | 200 | 150 | 400 MB |
| Global, per hour | 2 000 | 500 | 512 MB |

A blocked request raises SQLSTATE `BSL01` with a user-safe message. The browser
turns that into *"Too many birthday pages from this network just now. Try again
later."* — never a raw Postgres error.

### Why a trigger, and not the alternatives

The browser holds the publishable key and calls PostgREST and Storage directly.
A server action is advisory — a client can skip it and post straight to
`/rest/v1/birthday_pages`. An Edge Function has the same problem plus a bill. A
CAPTCHA needs a vendor. A `BEFORE INSERT` trigger is the only placement that
cannot be skipped with the keys the browser already holds, and it is free.

### Why the check happens before the increment

The obvious version — increment, then raise if over the limit — does not work.
Raising aborts the transaction and rolls the increment back, so the counter never
reaches the limit and every retry gets through forever. This file reads first:

1. read the counter for the current window;
2. if it is already full, raise — nothing was written;
3. otherwise increment and let the row through.

A blocked request never increments, which is fine: the counter is already at the
limit, so every retry during the window is blocked too.

A row that then fails a `CHECK` constraint rolls the increment back with it, so
only pages that were really created count against the quota.

### Why `rate_limit_counters` is not `force row level security`

A table's owner bypasses its own RLS unless `FORCE` is set. The owner-run
`SECURITY DEFINER` limiter needs exactly that to write counters, so the file
enables RLS but deliberately does not force it. Forcing it would lock the limiter
out and break every write path.

Clients get no grant on this table at all, which is what actually matters.

---

## 3. Tightened validation

The migration adds database-level character checks that mirror the app's:

- `name` and `message` reject control characters and invisible characters such as
  zero-width joiners and bidi overrides.
- Messages keep tab, newline and carriage return — those are legitimate text.
- `message` is now `char_length(btrim(message)) between 1 and 500`, so a
  whitespace-only message is rejected in the database as well as the browser.

These are defence in depth. The app already rejects this input; the checks mean
a hostile client that skips the app still cannot store it.

---

## 4. Orphan cleanup

Two server actions in `app/actions/cleanup-orphan-photos.ts` share one guard:
**a folder is only ever deleted when no live row references it.** That is what
makes them safe to expose, since both are anonymously callable.

### Immediate cleanup — `cleanupOrphanedPhotos(paths)`

Called when a save fails, for paths the app already uploaded. Bounded at 200
paths per call so the public endpoint cannot be turned into an amplification
primitive.

### Stale sweep — `cleanupStaleOrphanedPhotos()`

Covers the case no code can observe: the browser disappears mid-upload — tab
closed, crash, laptop asleep — and the uploads it already wrote stay forever.
The app fires this opportunistically after a successful save. It sweeps **both**
`birthday-photos` and `birthday-audio`, since an interrupted save can strand a
track just as easily as photos. It is bounded by three properties:

- **Bounded** — at most 50 folders examined per call, across both buckets.
- **Age-gated** — a folder younger than 6 hours is never touched, so an in-flight
  slow upload keeps its folder. Age is decided by the *newest* object, the
  conservative choice.
- **Fails closed** — any error, including "listing unavailable", deletes nothing.

The function name still says "photos" because that is what it was called when
photos were the only upload. Renaming it would churn its three call sites for no
behavioural gain.

It is throttled to one sweep per server instance per 10 minutes. The timestamp is
claimed only after the root listing succeeds, so a transient Storage outage
does not also cost the next ten minutes of sweeps.

### Known limits — read this before trusting the sweep

- **A fire-and-forget call can be cancelled.** The sweep rides along with a user
  request; if they navigate away, it may not finish.
- **Zero traffic means zero sweeps.** Nobody is saving, so nobody triggers one.
- **Serverless instances are ephemeral**, so the 10-minute throttle is per
  instance. A burst can spread across fresh instances and each allows one sweep.

This is an opportunistic safety net, not a guarantee. Keep the **Storage
lifecycle rule** as the real backstop: Storage → **Settings → Lifecycle** →
expire objects in `birthday-photos` **and** `birthday-audio` after N days. That is
what actually reclaims abandoned folders, and it works whether or not anyone ever
returns to the site.

Without `SUPABASE_SECRET_KEY` both actions return `skipped` and the app still
works end to end; the lifecycle rule then becomes the only cleanup path.

---

## 5. Test-only endpoint

`app/api/test-cleanup/route.ts` exposes both actions over HTTP so the regression
suite can drive the real code. It is **development only**: `NODE_ENV` is inlined
at build time, so in a production bundle the handler is dead code and the route
returns 404.

Verified against a real production build:

| Request | Response |
| --- | --- |
| `POST /api/test-cleanup {"mode":"sweep"}` | `404 {"error":"not found"}` |
| `POST /api/test-cleanup {"paths":[…]}` | `404 {"error":"not found"}` |
| `POST /api/test-cleanup {"bucket":"audio",…}` | `404 {"error":"not found"}` |
| `GET /` | `200` |
| `GET /create` | `200` |
| `GET /birthday/<32 hex>` unknown | `404` |

---

## 6. Required birthday date, and pages that expire

The birthday month and day are required. There is **no year** — a year would turn
a nice page into a directory of people's ages, and nothing in the product needs it.

Only month and day are stored, plus `expires_at`, which the **database** computes.
The app never sends a value for it: the `BEFORE INSERT` trigger
`birthday_pages_set_expiry` calls `birthday_set_expiry()` and overwrites whatever
arrived using the server's `now()`. A client that posts `expires_at` in year 2099
gets it discarded and the correct one stored instead.

### The boundary

A page works until the **end** of its birthday: `23:59:59.999 Asia/Kolkata` on
that date. The public RPC filters on `now() < expires_at`, so the birthday itself
is still live and the next instant is not.

29 February is a real birthday and is stored as-is. In a non-leap year it is
observed on 28 February. The arithmetic in `lib/birthday-date.ts` is verified
against `birthday_expiry_for()` in SQL over 2024–2033 — every day of every year,
455,910 pairs, byte-identical results. That harness is the reason the two
implementations cannot drift.

### Existing rows

Adding `NOT NULL` columns to a table with rows in it would fail. The migration
backfills January 1 and sets `expires_at = now() + interval '1 year'`, so old pages
stay reachable for roughly a year instead of expiring the moment you deploy.
New rows get no such grace period.

Expired and unknown ids are indistinguishable: both return not-found. A visitor
cannot tell that a page existed and has passed.

---

## 7. Optional private audio

A page may carry one track. It is **not** required, and leaving it out changes
nothing about how a page renders.

| | |
| --- | --- |
| Bucket | `birthday-audio`, **private** |
| Formats | MP3, M4A, OGG |
| Max size | 5 MB |
| Stored path | `<32 hex public id>/<random>.<ext>` |

Three deliberate choices:

- **The bucket is private.** Photos stay public, because they are inlined into the
  page. A track is signed per request with a TTL capped to the page's own
  remaining life, so the URL cannot outlive the page.
- **The MIME comes from the extension**, never from `File.type`. Browsers report
  `audio/mp4` and `audio/x-m4a` for the same file depending on platform, and M4A
  arrives as `""` on some Android browsers. Trusting `File.type` would reject
  valid tracks on exactly the devices least able to work around it.
- **The original filename is never stored**, so a hostile one cannot reach a
  rendered page. The object name is random, and the trigger
  `birthday_pages_audio_scoped` — running `assert_audio_path_scoped()` — refuses
  any path outside the row's own folder, mirroring the photo rules.
  `lib/birthday-page.ts` repeats that scope check before signing, because a path
  that passes the shape test but names another page's folder would otherwise be
  signed and leak that page's track.

The visitor side renders defensively, consistent with the "Storage should never
bring a page down" goal. A photo that fails to load (deleted early, URL expired,
Storage gone) swaps in a fallback tile in place; it never shows a broken-image
icon. The audio element stays mounted even when autoplay is refused, so a single
trusted tap starts the track, and a track that cannot play offers **no control at
all** — nothing a visitor can tap is ever shown that would not play. Both facts
are covered by the browser suites in `bd-gallery-fallback.mjs` and
`bd-audio-player.mjs`.

---

## 8. Reclaiming expired pages

Expiry makes a page **unreachable**. It does not free the Storage it used. That
is deliberate: a page going quiet should never risk deleting a live page's files,
so the two concerns are separate.

Media is reclaimed **media first, row second**:

1. `pending_expiry_cleanup()` returns a bounded batch of expired rows.
2. Their photo and audio paths are validated, then deleted.
3. `purge_expired_birthday_page(public_id)` deletes each row, guarded so it can
   only ever remove an already-expired row.

If a delete fails the row is **kept**, so the next run retries it. Nothing is
resurrected in the meantime — the row was already past `expires_at`, so the public
RPC was not serving it anyway.

### Calling it

`GET` or `POST /api/cron/expired`, authenticated with `CRON_SECRET` as either
`Authorization: Bearer <value>` or `x-cron-secret`. **If `CRON_SECRET` is unset the
route refuses every request** and returns 503, on purpose: "no secret configured"
must never degrade into "no authentication" on a route that deletes files.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.example/api/cron/expired
```

Verified against a production build, with `CRON_SECRET` unset:

| Request | Response |
| --- | --- |
| `GET /api/cron/expired` | `503` |
| `POST /api/cron/expired` | `503` |
| `GET /api/cron/expired` with `x-cron-secret: wrong` | `503` |

And with it set, against the same build:

| Request | Response |
| --- | --- |
| no header | `401` |
| `Authorization: Bearer wrong` | `401` |
| `x-cron-secret: wrong` | `401` |
| `Authorization: Bearer <correct value minus last 4 chars>` | `401` |
| `Authorization: Bearer <correct>` | passes auth, then runs |
| `x-cron-secret: <correct>` | passes auth, then runs |

Both headers are accepted and both wrong values are rejected. A truncated prefix of
the real secret is rejected too, so the comparison is not a prefix match. "Passes
auth, then runs" is `200` with a cleanup summary on a real project; in a sandbox
with no Supabase reachable it is `503` with `reason: "list-failed"`. That is the
same fail-closed outcome as a missing credential — in both cases nothing was
deleted.

None of this is required. Without it, expired pages are still unreachable and the
Storage lifecycle rule reclaims the objects on its own schedule.

### Optional: run it on a timer

`supabase/cron/expire-birthdays.sql` schedules an hourly POST via `pg_cron` and
`pg_net`, reading both the URL and the secret from Supabase Vault so neither lands
in `cron.job.command`, which anyone with `pg_catalog` read access can see.

Set the site URL to **your deployed app's origin**, not your Supabase project URL —
the job posts to `<site_url>/api/cron/expired`, and that is a Next.js handler in
this app. Pointing it at `https://<project-ref>.supabase.co` would 404 forever.
Both values must match the deployment's environment, or every request 401s.

---

## 9. Regression results

| Suite | Result |
| --- | --- |
| Phase 6 unit — validation, limits, error mapping | 227 / 227 |
| Phase 6 cleanup — age gate, ownership, fail-closed, throttle | 16 / 16 |
| Phase 6 date arithmetic, incl. 29 February | 33 / 33 |
| SQL ↔ TypeScript expiry parity, 2024–2033 | 455,910 pairs, identical |
| Phase 5 regression against mock Supabase | 77 / 77 |
| Phase 4 baseline | 225 / 225 |
| `npx tsc --noEmit -p tsconfig.json` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |

The cleanup suite is order-sensitive by design: the sweep throttle keeps its
timestamp in module state, so restart `next dev` before running it, and note
that only one successful sweep is possible per 10-minute window.

Two Phase 5 harness assertions had to be corrected. They counted the sweeper's
`POST /storage/v1/object/list/…` as an app upload. The app behaviour was never
wrong — the classifier was, written before the sweeper existed.

---

## 10. Not verified

Neither migration has been applied to your project, so the following are written
and reviewed but untested against a real Postgres:

- whether `new.metadata->>'size'` is populated early enough in the Storage
  `BEFORE INSERT` trigger for the byte limits to bind;
- that `request.headers` surfaces `X-Forwarded-For` on your project;
- the live `BSL01` message and the exact per-IP enforcement;
- that the `sb_secret_` key resolves to a role that `service_role` grants on the
  cleanup RPCs actually reach;
- that `pending_expiry_cleanup()` and `purge_expired_birthday_page()` behave as
  written against live rows.

`pg_cron`, `pg_net` and Vault are **also** unverified here. If the scheduled
cleanup in section 8 does not work on your project, nothing breaks — the page
expiry that makes it worthwhile has already taken effect, and the Storage
lifecycle rule reclaims the objects regardless.

The byte checks are written to degrade safely: if `metadata->>'size'` is missing
the trigger contributes a zero-byte read rather than rejecting the upload, so a
wrong assumption there cannot take the site offline. It would only mean byte
limits bind less tightly than intended. Check `select public.rate_limit_probe()`
and the self-test above after applying.