"use server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  AUDIO_BUCKET,
  BIRTHDAY_TABLE,
  PHOTO_BUCKET,
  isValidPublicId,
} from "@/lib/birthday-page";

/**
 * Upper bound on how many paths one cleanup call will consider.
 *
 * A page holds at most 20 photos, so a genuine failed save submits 20 or fewer.
 * The allowance above that is for a batch that failed partway through several
 * attempts; anything larger is abuse, not cleanup.
 */
const MAX_CLEANUP_PATHS = 200;

/**
 * Deletes photo uploads that were written for a page that never got saved.
 *
 * Why this needs a secret key: the migration grants `anon` no DELETE policy on
 * `storage.objects`, on purpose — a browser client must never be able to delete
 * photos from a birthday page that has already been shared. That leaves this
 * server action as the only delete path in the system.
 *
 * Why exposing it is nevertheless safe. This action is callable by anyone, so
 * "it runs server-side" is not a defence on its own. The guard below is:
 *
 *   A folder is only deleted when the database contains NO row for that
 *   public_id.
 *
 * An attacker can therefore ask to delete any folder they like, but the only
 * folders that can actually be removed are ones that were never referenced by a
 * live page — which is exactly the orphan set, and nothing else. A published
 * page's photos are untouchable by this endpoint.
 *
 * The path shape is also re-validated here. Trusting the caller's strings would
 * let a crafted path escape the bucket prefix.
 *
 * A row that still exists — published or merely expired — is never reachable
 * from here; the ownership guard treats both identically. Expired pages are
 * reclaimed separately by `cleanupExpiredBirthdayPages` (in
 * cleanup-expired-birthdays.ts), which is why this file deliberately never
 * references the `pending_expiry_cleanup` / `purge_expired_birthday_page`
 * RPCs: this action must never delete a row, and folding row deletion in here
 * would let an unauthenticated caller trigger it.
 */
export async function cleanupOrphanedPhotos(
  paths: readonly string[],
): Promise<{ removed: number; skipped: boolean; reason?: string }> {
  return cleanupOrphanedPathsIn(PHOTO_BUCKET, paths);
}

/**
 * The same rollback for the optional audio track.
 *
 * Separate rather than a `bucket` argument because this file is a server action:
 * a caller-supplied bucket name would be a caller choosing which bucket the
 * secret key is pointed at, and a string that reached Storage unvalidated would
 * be a much more serious bug than a stray photo. Two named entry points cannot
 * express that mistake.
 */
export async function cleanupOrphanedAudio(
  paths: readonly string[],
): Promise<{ removed: number; skipped: boolean; reason?: string }> {
  return cleanupOrphanedPathsIn(AUDIO_BUCKET, paths);
}

async function cleanupOrphanedPathsIn(
  bucket: string,
  paths: readonly string[],
): Promise<{ removed: number; skipped: boolean; reason?: string }> {
  const admin = getAdminSupabase();
  if (!admin) {
    // Optional feature. The app works without a secret key; uploads orphaned
    // by a failed save simply linger until a lifecycle policy removes them.
    return { removed: 0, skipped: true, reason: "no-server-credentials" };
  }

  if (!Array.isArray(paths) || paths.length === 0) {
    return { removed: 0, skipped: false };
  }

  // This action is callable by anyone, so the input is treated as hostile.
  // A caller could otherwise post a million-element array and turn a cleanup
  // into an amplification primitive: one request, a million filter callbacks and
  // a giant `in (...)` clause. One page can hold at most PHOTO_MAX_COUNT
  // photos, so anything beyond a small multiple of that is not a real caller.
  if (paths.length > MAX_CLEANUP_PATHS) {
    return { removed: 0, skipped: true, reason: "too-many-paths" };
  }

  // Only accept well-formed "<32-hex>/<file>" paths for real public ids.
  const safe = paths.filter((path): path is string => {
    if (typeof path !== "string") return false;
    const parts = path.split("/");
    return parts.length === 2 && isValidPublicId(parts[0]) && /^[\w.-]{1,80}$/.test(parts[1]);
  });

  if (safe.length === 0) {
    return { removed: 0, skipped: false };
  }

  const folders = [...new Set(safe.map((path) => path.split("/")[0]))];

  // The ownership guard: any folder that a live row still references is off
  // limits, even if the caller asked for it.
  const { data: live, error: lookupError } = await admin
    .from(BIRTHDAY_TABLE)
    .select("public_id")
    .in("public_id", folders);

  if (lookupError) {
    // Fail closed. Leaving an orphan behind is recoverable; deleting a live
    // page's photos is not.
    return { removed: 0, skipped: true, reason: "lookup-failed" };
  }

  const liveFolders = new Set((live ?? []).map((row) => row.public_id as string));
  const removable = safe.filter((path) => !liveFolders.has(path.split("/")[0]));

  if (removable.length === 0) {
    return { removed: 0, skipped: false };
  }

  const { data: removed, error: removeError } = await admin.storage
    .from(bucket)
    .remove(removable);

  if (removeError) {
    return { removed: 0, skipped: true, reason: "remove-failed" };
  }

  // Storage returns the paths it actually removed. Counting those instead of
  // assuming the whole batch landed keeps the number honest for the test suite
  // and for the caller deciding whether to retry.
  return { removed: Array.isArray(removed) ? removed.length : 0, skipped: false };
}

/**
 * Folders are only ever considered for sweeping once they are old enough that no
 * in-flight save could still be completing.
 *
 * 6 hours is deliberately far longer than any real upload. A creator on a slow
 * connection uploading twenty 10 MB photos has a legitimate claim on their
 * folder for minutes, not hours; after that the only reason it still exists is
 * that the tab was closed, the device died, or the network dropped mid-batch.
 */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/** Hard ceiling on folders examined per call, so this stays cheap. */
const MAX_FOLDERS_PER_SWEEP = 50;

/**
 * Minimum gap between sweeps served by one server instance.
 *
 * This action is anonymously callable, and each sweep costs up to
 * MAX_FOLDERS_PER_SWEEP Storage listings. Without a throttle, "call this endpoint
 * in a loop" would be a cheap way to turn one request into many Storage calls.
 *
 * This is deliberately described as best-effort rather than as a hard guarantee:
 * serverless instances are ephemeral, so a burst of requests can spread across
 * several fresh instances and each will allow one sweep. It raises the cost of
 * abuse without pretending to make the endpoint rate-limited, which is the
 * database's job, not this file's.
 */
const SWEEP_THROTTLE_MS = 10 * 60 * 1000;
let lastSweepAt = 0;

/**
 * Removes uploads left behind when a save never finished at all.
 *
 * `cleanupOrphanedPhotos` covers every failure the app can observe: it is called
 * on an upload error, on an INSERT error and from the catch-all. What it cannot
 * cover is the case where the browser disappears — tab closed, crash, laptop
 * asleep — because then no code runs at all and the uploads it had already
 * written stay in the bucket forever, costing storage on a free-tier project.
 *
 * This is the safety net for that case. It re-uses the same ownership guard: a
 * folder is only removed when the database holds no row referencing it, so a
 * published page's photos and audio remain unreachable from here as well.
 *
 * Both buckets are swept. The name still says "photos" because that is what it was
 * called when photos were the only upload; renaming it would churn the three
 * call sites for no behavioural gain, and the added bucket is the safer default.
 *
 * Three properties keep it safe to run opportunistically from a request:
 *
 *   * it is bounded — at most MAX_FOLDERS_PER_SWEEP folders are examined;
 *   * it is age-gated — a folder younger than STALE_AFTER_MS is never touched;
 *   * it fails closed — any error, including "listing is unavailable", results
 *     in no deletion at all.
 *
 * Note: listing goes through the JS client on purpose. The raw
 * `GET /storage/v1/object/list/<bucket>` route is not dependable on every
 * project, and a silently empty listing would make this look like "nothing to do"
 * forever.
 */
export async function cleanupStaleOrphanedPhotos(): Promise<{
  scanned: number;
  removed: number;
  skipped: boolean;
  reason?: string;
}> {
  const admin = getAdminSupabase();
  if (!admin) {
    return { scanned: 0, removed: 0, skipped: true, reason: "no-server-credentials" };
  }

  // Both buckets. An interrupted save can leave an audio track behind just as
  // easily as photos, and a sweep that ignored the audio bucket would let those
  // accumulate indefinitely on a free-tier project.
  const candidatesByBucket = new Map<string, string[]>();
  let scannedTotal = 0;

  /*
   * The throttle is claimed once per call, and it is claimed here — before the
   * loop — rather than inside it.
   *
   * Claiming inside the loop looked harmless when there was one bucket, but with
   * two it is self-defeating: the photos iteration claims the throttle, and the
   * audio iteration then finds `now - lastSweepAt` is 0 and bails out as
   * "throttled" before deleting anything. The whole sweep became a no-op that
   * reported itself throttled.
   */
  if (Date.now() - lastSweepAt < SWEEP_THROTTLE_MS) {
    return { scanned: 0, removed: 0, skipped: true, reason: "throttled" };
  }

  /*
   * Claimed on the first root listing that actually succeeds, not before the loop
   * and not on every attempt.
   *
   * Claiming up front would mean a single transient Storage outage cost the next
   * ten minutes of sweeps as well, which is the wrong trade: the expensive part
   * of a sweep is the per-folder listings below, and a root listing that failed
   * never reached any of them. So an attempt that did no work stays retryable,
   * while a sweep that actually started is throttled.
   */
  let claimed = false;

  for (const bucketId of [PHOTO_BUCKET, AUDIO_BUCKET]) {
    const bucket = admin.storage.from(bucketId);

    const { data: entries, error: listError } = await bucket.list("", { limit: 1000 });
    if (listError) {
      // Fail closed. A failed listing must never be read as "there is nothing to
      // clean up" for any other purpose than skipping this run.
      return { scanned: scannedTotal, removed: 0, skipped: true, reason: "list-failed" };
    }

    if (!claimed) {
      lastSweepAt = Date.now();
      claimed = true;
    }

    const folders = (entries ?? []).filter(
      (entry) => typeof entry?.name === "string" && isValidPublicId(entry.name),
    );

    if (folders.length === 0) continue;

    const candidates: string[] = [];
    const names: string[] = [];
    let scanned = 0;

    for (const folder of folders.slice(0, MAX_FOLDERS_PER_SWEEP)) {
      scanned += 1;

      const { data: files, error: fileError } = await bucket.list(folder.name, { limit: 100 });
      if (fileError) {
        return { scanned: scannedTotal, removed: 0, skipped: true, reason: "list-failed" };
      }

      const objects = (files ?? []).filter(
        (file) => file && typeof file.name === "string" && typeof file.id === "string",
      );

      if (objects.length === 0) continue;

      // Newest object decides the folder's age. If any part of the batch is
      // still fresh the folder is in use, because uploads for one page are
      // written in a tight sequence. Taking the newest rather than the oldest is
      // the conservative choice: it can only ever decline to delete something that
      // a slower uploader is still writing to.
      const newest = objects.reduce((latest, file) => {
        const stamp = Date.parse(file.created_at ?? file.updated_at ?? "");
        return Number.isFinite(stamp) && stamp > latest ? stamp : latest;
      }, 0);

      if (newest === 0 || Date.now() - newest < STALE_AFTER_MS) continue;

      candidates.push(...objects.map((file) => `${folder.name}/${file.name}`));
      names.push(folder.name);
    }

    scannedTotal += scanned;

    if (candidates.length === 0) continue;

    // The same ownership guard as the on-failure cleanup, re-checked here so a
    // page published while this sweep was listing is never touched.
    const { data: live, error: lookupError } = await admin
      .from(BIRTHDAY_TABLE)
      .select("public_id")
      .in("public_id", names);

    if (lookupError) {
      return { scanned: scannedTotal, removed: 0, skipped: true, reason: "lookup-failed" };
    }

    const liveFolders = new Set((live ?? []).map((row) => row.public_id as string));
    const removable = candidates.filter((path) => !liveFolders.has(path.split("/")[0]));

    if (removable.length > 0) {
      candidatesByBucket.set(bucketId, removable);
    }
  }

  if (candidatesByBucket.size === 0) {
    return { scanned: scannedTotal, removed: 0, skipped: false };
  }

  // Removed per bucket rather than in one call: Storage's remove() takes paths
  // relative to a single bucket, and mixing them would address the wrong object.
  let removedTotal = 0;

  for (const [bucketId, removable] of candidatesByBucket) {
    const { data: removed, error: removeError } = await admin.storage
      .from(bucketId)
      .remove(removable);

    if (removeError) {
      // Partial success is still progress and the objects already removed cannot
      // be put back, so the count is reported rather than thrown away. Whatever
      // is left is collected by the next sweep.
      return {
        scanned: scannedTotal,
        removed: removedTotal,
        skipped: true,
        reason: "remove-failed",
      };
    }

    removedTotal += Array.isArray(removed) ? removed.length : 0;
  }

  return { scanned: scannedTotal, removed: removedTotal, skipped: false };
}
