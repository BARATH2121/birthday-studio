import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  AUDIO_BUCKET,
  PHOTO_BUCKET,
  isValidAudioPath,
  isValidPhotoPath,
} from "@/lib/birthday-page";

/**
 * Upper bound on how many rows one invocation considers.
 *
 * The query orders by `expires_at`, so the oldest expiries are always reclaimed
 * first and the cap never starves the pages that have been dead longest.
 */
const DEFAULT_BATCH = 25;

const MAX_BATCH = 100;

/**
 * Object paths per Storage `remove()` call.
 *
 * `remove()` takes a list and has no documented hard limit, but an unbounded list
 * makes one failure abandon the whole batch — and the more paths are in flight,
 * the more expensive the retry. 100 keeps a single call well inside anything the
 * Storage API is likely to reject.
 */
const REMOVE_CHUNK = 100;

const PENDING_CLEANUP_RPC = "pending_expiry_cleanup";
const PURGE_RPC = "purge_expired_birthday_page";

export type ExpiredCleanupResult = {
  /** Expired rows examined. */
  scanned: number;
  /** Rows whose media was deleted and which were then removed. */
  removed: number;
  /**
   * Rows still present because their media could not be fully deleted, or the row
   * survived. Retried next sweep.
   */
  retained: number;
  /** True when the run could not proceed at all. */
  skipped: boolean;
  reason?: string;
};

type PendingRow = {
  id: number;
  public_id: string;
  photo_paths: string[] | null;
  audio_path: string | null;
};

/**
 * Reclaims the media belonging to expired pages, then deletes the rows.
 *
 * Order matters, and it is the whole design of this function: **media first, row
 * second.** The row is what makes a page reachable, and its `photo_paths` are the
 * only record of where its media lives. Deleting the row first would orphan
 * objects that nothing points at any more, recoverable only by the separate stale
 * sweep hours later -- and an expired page's photos are public URLs, so they
 * would stay downloadable in the meantime.
 *
 * If any media fails to delete, no row in the batch is deleted. Rows are kept
 * because a leftover row is inert -- the public RPC filters on `expires_at`, so
 * the page is already unreachable -- while orphaned photo objects are permanently
 * public. Keeping the row also records which paths to retry, instead of leaving
 * the next sweep to rediscover them by scanning Storage.
 *
 * Nothing here touches `birthday_pages` directly. Both the listing and the delete
 * go through SECURITY DEFINER functions granted to `service_role` only, because
 * the server key is deliberately given no SELECT or DELETE on the table. A grant
 * would have been the shorter route to a working cleanup, at the cost of a
 * permanent "delete any row" capability in the server's hands.
 */
export async function cleanupExpiredBirthdayPages(
  batchSize: number = DEFAULT_BATCH,
): Promise<ExpiredCleanupResult> {
  const admin = getAdminSupabase();
  if (!admin) {
    return {
      scanned: 0,
      removed: 0,
      retained: 0,
      skipped: true,
      reason: "no-server-credentials",
    };
  }

  const limit = Math.min(Math.max(Math.trunc(batchSize) || DEFAULT_BATCH, 1), MAX_BATCH);

  const { data, error: listError } = await admin.rpc(PENDING_CLEANUP_RPC, {
    p_limit: limit,
  });

  if (listError) {
    return { scanned: 0, removed: 0, retained: 0, skipped: true, reason: "list-failed" };
  }

  const expired = (data ?? []) as PendingRow[];
  if (expired.length === 0) {
    return { scanned: 0, removed: 0, retained: 0, skipped: false };
  }

  const scanned = expired.length;
  const publicIds = expired.map((row) => row.public_id);

  const photoPaths = expired.flatMap((row) => row.photo_paths ?? []);
  const audioPaths = expired
    .map((row) => row.audio_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

  // Both buckets must succeed before any row is deleted. A partially reclaimed
  // batch is not treated as done: the rows stay, so the next run retries the
  // paths that are still there instead of losing track of them.
  const photos = await deletePaths(admin, PHOTO_BUCKET, photoPaths, isValidPhotoPath);
  if (!photos.ok) {
    return { scanned, removed: 0, retained: scanned, skipped: true, reason: photos.reason };
  }

  const audio = await deletePaths(admin, AUDIO_BUCKET, audioPaths, isValidAudioPath);
  if (!audio.ok) {
    return { scanned, removed: 0, retained: scanned, skipped: true, reason: audio.reason };
  }

  /*
   * Purged one at a time rather than in a single `in (...)` delete, because the
   * function reports whether it removed anything. A row that was already gone --
   * deleted by a concurrent sweep, or never committed -- is counted as retained
   * rather than silently folded into the success count.
   */
  let removed = 0;

  for (const publicId of publicIds) {
    const { data: purged, error: purgeError } = await admin.rpc(PURGE_RPC, {
      p_public_id: publicId,
    });

    if (purgeError) {
      return {
        scanned,
        removed,
        retained: scanned - removed,
        skipped: true,
        reason: "row-delete-failed",
      };
    }

    if (purged === true) removed += 1;
  }

  return { scanned, removed, retained: scanned - removed, skipped: false };
}

/**
 * Deletes every listed path from one bucket.
 *
 * Paths are split into a `valid` set and a `rejected` set. Rejected paths are
 * dropped rather than forwarded: they were never going to exist under a valid
 * name, and passing an unvalidated string to Storage would turn this function
 * into an arbitrary-object-delete primitive. An empty list is a success -- a page
 * with no audio, or none with photos, is the normal case, not a failure.
 */
async function deletePaths(
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>,
  bucketId: string,
  paths: readonly string[],
  isValidPath: (value: unknown) => value is string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const valid = paths.filter(isValidPath);

  for (let start = 0; start < valid.length; start += REMOVE_CHUNK) {
    const chunk = valid.slice(start, start + REMOVE_CHUNK);

    const { error } = await admin.storage.from(bucketId).remove(chunk);
    if (error) {
      return { ok: false, reason: `${bucketId}-remove-failed` };
    }
  }

  return { ok: true };
}

/**
 * Confirms each folder is empty, for the manual verification step in the runbook.
 *
 * Not called by `cleanupExpiredBirthdayPages`. It exists because "Storage returned
 * no error" and "the objects are actually gone" are different claims, and only the
 * second is worth trusting before a row has been deleted for good.
 */
export async function verifyFoldersEmpty(
  publicIds: readonly string[],
): Promise<{ empty: boolean; checked: string[]; remaining: string[] }> {
  const admin = getAdminSupabase();
  if (!admin) return { empty: false, checked: [], remaining: [] };

  const remaining: string[] = [];
  const checked: string[] = [];

  for (const publicId of publicIds) {
    checked.push(publicId);

    const [photos, audio] = await Promise.all([
      admin.storage.from(PHOTO_BUCKET).list(publicId, { limit: 100 }),
      admin.storage.from(AUDIO_BUCKET).list(publicId, { limit: 100 }),
    ]);

    if ((photos.data ?? []).length > 0 || (audio.data ?? []).length > 0) {
      remaining.push(publicId);
    }
  }

  return { empty: remaining.length === 0, checked, remaining };
}