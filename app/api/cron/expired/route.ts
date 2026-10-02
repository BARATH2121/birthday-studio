import { NextResponse } from "next/server";
import { cleanupExpiredBirthdayPages } from "@/app/actions/cleanup-expired-birthdays";

/**
 * Scheduled reclamation of expired pages.
 *
 * This is a maintenance endpoint, not a user-facing one. Its only job is to stop
 * the project accumulating storage it is being billed for: the public RPC already
 * stops serving a page the moment it expires, so nothing here affects whether a
 * link works. It only decides when the underlying objects are actually deleted.
 *
 * Consequently it is safe for this to never run. Nothing breaks if the schedule
 * is missing — pages stop working on time, the storage just costs more. That
 * asymmetry is the reason the endpoint is authenticated rather than open: an open
 * one would let anyone trigger mass deletes, and there is nothing useful enough
 * about the result to justify that.
 *
 * Authentication is a shared secret in the `Authorization` header, compared in
 * constant time. There are no user accounts in this system and no sessions to
 * borrow, so a bearer secret is the whole of the trust model.
 */

// Never cached, and never statically optimised: this must run per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Length-based comparison that does not leak where two strings diverge.
 *
 * A plain `===` on a secret returns as soon as it finds a mismatch, and the time
 * taken leaks how many leading characters were correct. With a value an attacker
 * can submit arbitrarily many times, that is enough to recover the secret one
 * character at a time.
 */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Accepts `Authorization: Bearer <secret>` and `x-cron-secret`.
 *
 * Both are read because schedulers differ: Supabase `pg_net` sends a plain
 * `Authorization` header, while hand-run `curl` and most external cron UIs are
 * configured more easily with a dedicated header. Accepting both avoids a
 * deployment where the schedule silently 401s on a header mismatch.
 */
function readProvidedSecret(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match) return match[1].trim();
  }

  const dedicated = request.headers.get("x-cron-secret");
  return dedicated ? dedicated.trim() : null;
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = readProvidedSecret(request);

  /*
   * Fail closed when `CRON_SECRET` is not configured.
   *
   * The alternative — treating an unset secret as "no secret required" — would
   * quietly turn this into an unauthenticated mass-delete endpoint on any
   * deployment that forgot the variable. Refusing to run is the only safe default;
   * expired media is reclaimed by the manual sweep until it is set.
   */
  if (!expected || expected.trim().length === 0) {
    console.error("[cron] CRON_SECRET is not configured; refusing to run");
    return NextResponse.json(
      { ok: false, error: "not-configured" },
      { status: 503 },
    );
  }

  if (!provided || !secretMatches(provided, expected.trim())) {
    // Deliberately terse and identical for a missing and a wrong secret. Saying
    // which one it was would confirm that the variable exists at all.
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  /*
   * No timeout wrapper. Supabase's fetch takes no abort signal, so an
   * `AbortController` here could not actually cancel a hung Storage call — it
   * would only add a timer that fires after the work has already finished.
   * The batch size is the real bound on how long this can take.
   */
  try {
    const result = await cleanupExpiredBirthdayPages();

    console.log("[cron] expired cleanup", result);

    /*
     * 503 on a partial or failed run, so a scheduler that watches status codes
     * notices and retries rather than treating a failure as success. `ok` stays
     * true for a partial run because the work that did happen was valid.
     */
    return NextResponse.json({ ok: true, ...result }, {
      status: result.skipped ? 503 : 200,
    });
  } catch (error) {
    console.error("[cron] expired cleanup threw", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

/**
 * POST is accepted as an alias for GET.
 *
 * Some cron UIs will only send POST. Routing both through one handler avoids
 * duplicating the authentication logic, and both are safe: the operation is
 * idempotent, so running it twice in a row simply finds nothing left to do.
 */
export async function POST(request: Request) {
  return GET(request);
}