import {
  cleanupOrphanedAudio,
  cleanupOrphanedPhotos,
  cleanupStaleOrphanedPhotos,
} from "@/app/actions/cleanup-orphan-photos";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AUDIO_MAX_BYTES, PHOTO_MAX_BYTES, isValidBirthdayDate } from "./birthday";
import {
  AUDIO_BUCKET,
  BIRTHDAY_TABLE,
  PHOTO_BUCKET,
  buildAudioPath,
  buildPhotoPath,
  classifyError,
  generatePublicId,
  isAudioMime,
  isSupportedPhotoMime,
  isValidAudioPath,
  isValidPhotoPath,
  randomHexSuffix,
  type GenerateFailure,
} from "./birthday-page";
import type { AudioMime, BirthdayDraft } from "./birthday";

export type SaveResult =
  | { ok: true; publicId: string }
  | { ok: false; failure: GenerateFailure; detail?: string };

/**
 * Saves a birthday page: uploads the chosen photos, then inserts the row.
 *
 * ORDER OF OPERATIONS — and why it differs from a literal reading of the spec.
 *
 * The obvious reading is "insert the row, then upload photos, then save the
 * photo references". That last step is an UPDATE, and the migration
 * deliberately does not grant `anon` any UPDATE policy — a browser client must
 * not be able to modify a page, including one it just created. A
 * create-then-update flow is therefore not available to us without weakening
 * exactly the rule we are trying to enforce.
 *
 * So the work is ordered the other way: upload first, insert last, with the
 * photo paths included in the INSERT. The guarantees the spec asks for all
 * still hold, and hold more strongly:
 *
 *   * a row can never exist without its photo references;
 *   * a row is never half-populated, so there is no window in which a shared
 *     page shows a broken gallery;
 *   * a failure at any point is rolled back by deleting whatever was uploaded
 *     so far, and the caller is never told the page was created.
 *
 * The trade-off accepted: a browser crash mid-upload can leave files with no
 * row. `cleanupOrphanedPhotos` removes them on any handled failure, and
 * `cleanupStaleOrphanedPhotos`, kicked off after a successful save, collects
 * the unhandled case once it is old enough to be certain no save is still
 * running. docs/phase5-supabase-setup.md still recommends a Storage lifecycle
 * rule as a third layer.
 */
export async function saveBirthdayPage(draft: BirthdayDraft): Promise<SaveResult> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    return { ok: false, failure: "not-configured" };
  }

  // Checked here as well as in validateForGeneration. This is the point where a
  // malformed draft becomes a permanent row, and an impossible date has to be
  // refused before a single byte is uploaded — the insert would fail anyway, but
  // only after paying for every photo.
  if (!isValidBirthdayDate(draft.birthdayDay, draft.birthdayMonth)) {
    return { ok: false, failure: "invalid-data" };
  }

  const publicId = generatePublicId();
  const uploaded: string[] = [];
  let audioPath: string | null = null;

  try {
    if (draft.photos.length > 0) {
      const paths = await uploadPhotos(supabase, publicId, draft);
      // `paths.uploaded` is populated even on failure, so a batch that dies on
      // its third photo still gets its first two cleaned up. Reporting success
      // alone here would silently leak every photo uploaded before the error.
      uploaded.push(...paths.uploaded);
      if (!paths.ok) {
        await cleanupOrphanedPhotos(uploaded);
        return { ok: false, failure: "upload-failed", detail: paths.detail };
      }
    }

    // Audio is optional and uploaded after the photos, so the largest and most
    // likely batch is already committed by the time this runs.
    if (draft.audio) {
      const track = await uploadAudio(supabase, publicId, draft.audio);
      if (!track.ok) {
        await cleanupOrphanedPhotos(uploaded);
        return { ok: false, failure: "upload-failed", detail: track.detail };
      }
      audioPath = track.path;
    }

    const { error } = await supabase.from(BIRTHDAY_TABLE).insert({
      public_id: publicId,
      name: draft.birthdayPersonName.trim(),
      relationship: draft.relationship,
      message: draft.message.trim(),
      style: draft.style,
      photo_paths: uploaded,
      birthday_month: draft.birthdayMonth,
      birthday_day: draft.birthdayDay,
      // expires_at is deliberately absent. The BEFORE INSERT trigger computes it
      // from the server clock, and a value sent here would be overwritten — but
      // omitting it keeps the intent obvious to anyone reading this insert, and
      // means the app has no path to setting an expiry even by accident.
      ...(audioPath
        ? { audio_path: audioPath, audio_mime: draft.audio?.mime }
        : {}),
    });

    if (error) {
      // The row was not created, so the uploads just made are orphans.
      await cleanupOrphanedPhotos(uploaded);
      if (audioPath) await cleanupOrphanedAudio([audioPath]);
      return { ok: false, failure: classifyError(error), detail: error.message };
    }

    /*
     * Opportunistic stale sweep.
     *
     * The rollback above covers every failure the app can observe. It cannot
     * cover a browser that disappears mid-upload — tab closed, crash, network
     * dropped — because then no code runs and the uploads already written stay
     * in the bucket forever.
     *
     * This is what eventually collects those: every successful save is a moment
     * when the project is demonstrably in use, so it triggers one bounded,
     * age-gated sweep in the background.
     *
     * Deliberately NOT awaited. A sweep can cost up to MAX_FOLDERS_PER_SWEEP
     * Storage listings, and this person is looking at their share card right
     * now. If the browser cancels the request during navigation the sweep is
     * simply skipped and the next save picks it up, which is why the trailing
     * catch exists as well as the fire-and-forget.
     */
    void cleanupStaleOrphanedPhotos().catch(() => {});

    return { ok: true, publicId };
  } catch (thrown) {
    await cleanupOrphanedPhotos(uploaded);
    if (audioPath) await cleanupOrphanedAudio([audioPath]);
    return {
      ok: false,
      failure: classifyError(
        thrown instanceof Error ? { message: thrown.message } : null,
      ),
    };
  }
}

/**
 * Uploads the optional track to the private audio bucket.
 *
 * Same three guards as the photo path, and for the same reasons: read the bytes
 * rather than trusting the reported size, re-check the type after reading, and
 * assert the object path before writing anything. The MIME comes from the
 * extension that was validated when the file was picked, not from `blob.type`,
 * because browsers disagree about `.m4a` and the database only accepts three
 * exact values.
 */
async function uploadAudio(
  supabase: NonNullable<ReturnType<typeof getBrowserSupabase>>,
  publicId: string,
  audio: NonNullable<BirthdayDraft["audio"]>,
): Promise<{ ok: true; path: string } | { ok: false; detail: string }> {
  const fail = (detail: string) => ({ ok: false as const, detail });

  let blob: Blob;
  try {
    // The draft holds an object URL, as photos do, so Phase 4 stays untouched.
    const response = await fetch(audio.url);
    if (!response.ok) return fail("audio-unreadable");
    blob = await response.blob();
  } catch {
    return fail("audio-unreadable");
  }

  if (!isAudioMime(audio.mime)) return fail("audio-unsupported-type");

  if (blob.size <= 0 || blob.size > AUDIO_MAX_BYTES) {
    return fail("audio-wrong-size");
  }

  const path = buildAudioPath(publicId, audio.mime as AudioMime, randomHexSuffix());

  if (!isValidAudioPath(path)) return fail("audio-unsafe-path");

  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, {
    contentType: audio.mime,
    // Short, matching the signed URL lifetime. A cached private object is only
    // reachable through a signed URL anyway, but there is no reason to keep a
    // track in an edge cache after its page is gone.
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return fail(`audio-${error.message}`);

  return { ok: true, path };
}

/**
 * `uploaded` is always present, on success and on failure alike, so the caller
 * can clean up a partially completed batch. It is the same array reference the
 * loop appends to, so there is no second copy to keep in sync.
 */
type UploadOutcome =
  | { ok: true; uploaded: string[] }
  | { ok: false; detail?: string; uploaded: string[] };

async function uploadPhotos(
  supabase: NonNullable<ReturnType<typeof getBrowserSupabase>>,
  publicId: string,
  draft: BirthdayDraft,
): Promise<UploadOutcome> {
  const paths: string[] = [];

  // Sequential on purpose: a birthday page holds at most 20 photos, and
  // uploading in order keeps the array we build aligned with the array the
  // user arranged. It also avoids a burst of 20 parallel requests against the
  // free tier.
  const fail = (detail: string): UploadOutcome => ({ ok: false, detail, uploaded: paths });

  for (const [index, photo] of draft.photos.entries()) {
    let blob: Blob;
    let mimeType: string;

    try {
      // The draft holds object URLs, not File handles. Re-reading the object
      // URL is what lets Phase 4 stay completely untouched.
      const response = await fetch(photo.url);
      if (!response.ok) {
        return fail(`photo-${index + 1}-unreadable`);
      }
      blob = await response.blob();
      mimeType = blob.type || guessMimeFromName(photo.name);
    } catch {
      return fail(`photo-${index + 1}-unreadable`);
    }

    if (!isSupportedPhotoMime(mimeType)) {
      return fail(`photo-${index + 1}-unsupported-type`);
    }

    /*
     * Re-check the bytes actually read, not the size the file input reported.
     *
     * The form's number is a hint: the object URL is re-fetched here, and a
     * File can be replaced or the reported size can be anything a crafted
     * request chooses. The bucket's file_size_limit is the backstop, but
     * rejecting locally means an oversized photo costs a comparison rather than
     * a full upload that is refused at the end.
     */
    if (blob.size <= 0 || blob.size > PHOTO_MAX_BYTES) {
      return fail(`photo-${index + 1}-wrong-size`);
    }

    const path = buildPhotoPath(publicId, index, mimeType, randomHexSuffix());

    /*
     * The path is assembled here, never taken from the user, so this can only
     * fail if one of the pieces above was changed without updating the other.
     * It is asserted anyway: this is the last point before bytes are written to
     * Storage under a path the database will later be asked to vouch for, and a
     * mismatch would otherwise show up much later as an opaque CHECK violation
     * on the INSERT, after the upload had already succeeded.
     */
    if (!isValidPhotoPath(path)) {
      return fail(`photo-${index + 1}-unsafe-path`);
    }

    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: mimeType,
      cacheControl: "31536000",
      // Never overwrite: a colliding path must fail, not replace another
      // page's photo. Combined with 128-bit ids this is a formality, but it
      // means the storage policy can stay insert-only.
      upsert: false,
    });

    if (error) {
      return fail(`photo-${index + 1}-${error.message}`);
    }

    paths.push(path);
  }

  return { ok: true, uploaded: paths };
}

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
