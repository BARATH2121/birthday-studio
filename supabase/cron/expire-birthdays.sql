-- Optional scheduled reclamation of expired birthday pages.
--
-- NOT REQUIRED FOR CORRECTNESS. The public RPC already filters on `expires_at`,
-- so a page stops working the moment its birthday is over regardless of whether
-- anything below is installed. This only decides *when* the underlying Storage
-- objects are deleted, and therefore what the project is billed for.
--
-- If you skip this file entirely, nothing breaks. Expired pages go quiet on
-- schedule and their media is reclaimed later by the manual sweep in
-- docs/phase6-abuse-and-cleanup.md.
--
-- Requires: pg_cron and pg_net. Both are available on Supabase but must be
-- enabled in the dashboard under Database -> Extensions. Verify with:
--
--   select extname from pg_extension where extname in ('pg_cron','pg_net');
--
-- Verify this schedule after running it:
--
--   select jobid, schedule, active from cron.job order by jobid;

\set ON_ERROR_STOP on

begin;

-- Both values are stored in Vault rather than inlined into the job command, so
-- neither is written into cron.job.command -- a table anyone with read access to
-- pg_catalog can see.
--
-- The site URL is your *deployed app's* origin -- the same one that serves the
-- birthday pages -- NOT your Supabase project URL. The job posts to
-- "<site_url>/api/cron/expired", and that route is a Next.js handler in this
-- app. Pointing it at https://<project-ref>.supabase.co would post to the Supabase
-- API gateway, which has no such route and will 404 forever with nothing to show
-- for it. Take the origin from whatever actually serves the site, no trailing
-- slash: 'https://your-app.vercel.app', or 'https://birthday.example' behind your
-- own domain.
--
-- Create the secrets once:
--
--   select vault.create_secret('https://your-app.vercel.app', 'cron_site_url');
--   select vault.create_secret('<your CRON_SECRET>',              'cron_secret');
--
-- The CRON_SECRET value must also be set in your deployment's environment, as
-- `CRON_SECRET`. The two must match or every request 401s. Do not skip it: the
-- route refuses to run when CRON_SECRET is unset, deliberately, because
-- "no secret configured" must never degrade into "no authentication".
--
-- The site URL is a secret too, only so that it is not hard-coded in two places
-- that can drift. It is not confidential.
--
-- Verify what is stored without printing either value:
--
--   select name, (decrypted_secret <> '') as is_set
--     from vault.decrypted_secrets
--    where name in ('cron_secret', 'cron_site_url');

-- Hourly, a few minutes past the top of the hour.
--
-- The offset avoids the :00 spike that every other cron job on a shared
-- platform fires at, and hourly is far more often than needed: an expired page is
-- already unreachable, so the only thing being bought here is lower storage
-- spend. Running this daily would leave a window of up to a day of dead media
-- and change nothing about who can see a page.
--
-- The trailing '/api/cron/expired' is concatenated rather than hard-coded so
-- the URL only has to be correct in one place.
select cron.schedule(
  'expire-birthday-pages',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_site_url'
      ) || '/api/cron/expired',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    )
  $cron$
);

commit;

-- ---------------------------------------------------------------------------
-- Reading the results
-- ---------------------------------------------------------------------------
--
-- Logs land in Supabase's API logs for the deployed app. The route logs a
-- single structured line per run:
--
--   [cron] expired cleanup { scanned, removed, retained, skipped, reason }
--
-- A healthy hourly run looks like:
--
--   { scanned: 0, removed: 0, retained: 0, skipped: false }
--
-- `scanned` above 0 with `removed` below `scanned` means some rows were retained
-- because their media could not be deleted. That is the expected behaviour on a
-- Storage error: the rows stay so the next hour can retry them. Rows are not
-- lost and pages are not resurrected -- they were already past `expires_at`.
--
-- To remove the schedule:
--
--   select cron.unschedule('expire-birthday-pages');