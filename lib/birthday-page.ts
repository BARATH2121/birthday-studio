import {
  isValidBirthdayDate,
  isValidMonth,
  type BirthdayMonth,
} from "./birthday-date";

import {
  BIRTHDAY_STYLES,
  MESSAGE_MAX_LENGTH,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  PHOTO_SIZE_LABEL,
  PHOTO_TYPES,
  validateAudio,
  validateDetails,
  validateStyle,
  type AudioItem,
  type AudioMime,
  type BirthdayDraft,
  type BirthdayStyleId,
  type DraftErrors,
  type PhotoItem,
  type Relationship,
} from "./birthday";

/* -------------------------------------------------------------------------- */
/* Storage + table constants (must match supabase/migrations/*)               */
/* -------------------------------------------------------------------------- */

export const PHOTO_BUCKET = "birthday-photos";

/**
 * Private bucket. There is no `/object/public/` route for this one, which is the
 * entire point: a public bucket serves a URL to anyone holding it forever, and
 * Storage never consults the database, so an expired page's audio would keep
 * playing. The only reader is the server, which mints a URL that expires.
 */
export const AUDIO_BUCKET = "birthday-audio";

export const BIRTHDAY_TABLE = "birthday_pages";
export const READ_BIRTHDAY_RPC = "get_birthday_page";

/** 128 bits, lowercase hex. Matches the table's CHECK constraint. */
export const PUBLIC_ID_BYTES = 16;
export const PUBLIC_ID_LENGTH = PUBLIC_ID_BYTES * 2;
const PUBLIC_ID_PATTERN = /^[0-9a-f]{32}$/;

/** Matches the table's `birthday_pages_name_length` check. */
export const NAME_MAX_LENGTH = 80;

/* -------------------------------------------------------------------------- */
/* Public identifier                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A 128-bit identifier from the platform CSPRNG.
 *
 * Sequential ids are guessable: with a sequential id an attacker can enumerate
 * every birthday on the site by trying /birthday/1, /birthday/2, ... 128 bits
 * of entropy makes that infeasible, so possessing the link is the capability.
 *
 * Lowercase hex is chosen over base62 on purpose: a link that someone retypes
 * from a chat app still resolves regardless of letter case.
 */
export function generatePublicId(): string {
  const bytes = new Uint8Array(PUBLIC_ID_BYTES);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

/* -------------------------------------------------------------------------- */
/* Photo object paths                                                          */
/* -------------------------------------------------------------------------- */

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Object path for one photo: "<publicId>/<file>".
 *
 * The database trigger `assert_photo_paths_scoped` rejects any stored path
 * that does not start with the row's own public_id, so the folder is not just
 * a naming convention — it is enforced.
 *
 * The original filename is never used. It can contain personal data, and it
 * would be visible in the public object URL.
 */
export function buildPhotoPath(
  publicId: string,
  index: number,
  mimeType: string,
  randomSuffix: string,
): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? "jpg";
  return `${publicId}/${index}-${randomSuffix}.${extension}`;
}

export function isSupportedPhotoMime(value: string): boolean {
  return (PHOTO_TYPES as readonly string[]).includes(value);
}

/**
 * Shape every object path must have before it is uploaded or stored.
 *
 * This mirrors the Storage RLS policy and the `assert_photo_paths_scoped`
 * trigger exactly. It is duplicated in the application on purpose: those two are
 * the authority, but they report a violation as a raw Postgres error, which by
 * design never reaches the user. Asserting the shape here lets the app fail
 * closed with a sentence a person can act on, without ever loosening the
 * database rules.
 */
export const PHOTO_PATH_PATTERN = /^[0-9a-f]{32}\/[0-9]{1,2}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isValidPhotoPath(value: unknown): value is string {
  return typeof value === "string" && PHOTO_PATH_PATTERN.test(value);
}

/** Lowercase hex from the platform CSPRNG, used to make object names unique. */
export function randomHexSuffix(byteLength = 6): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* -------------------------------------------------------------------------- */
/* Audio object paths                                                           */
/* -------------------------------------------------------------------------- */

const EXTENSION_BY_AUDIO_MIME: Record<AudioMime, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
};

/**
 * Object path for the optional track: "<publicId>/<random>.<ext>".
 *
 * Scoped to the row's own folder by the `assert_audio_path_scoped` trigger, the
 * same way photos are, so a page cannot point at another page's audio. The
 * original filename is never used, for the same reason photos do not use one.
 */
export function buildAudioPath(
  publicId: string,
  mime: AudioMime,
  randomSuffix: string,
): string {
  return `${publicId}/${randomSuffix}.${EXTENSION_BY_AUDIO_MIME[mime]}`;
}

/**
 * Mirrors the Storage RLS policy and the `assert_audio_path_scoped` trigger, for
 * the same reason `PHOTO_PATH_PATTERN` does: the database is the authority, but
 * it reports a violation as a raw Postgres error that must never reach a user.
 */
export const AUDIO_PATH_PATTERN = /^[0-9a-f]{32}\/[0-9a-z-]{1,64}\.(mp3|m4a|ogg)$/;

export function isValidAudioPath(value: unknown): value is string {
  return typeof value === "string" && AUDIO_PATH_PATTERN.test(value);
}

export function isAudioMime(value: unknown): value is AudioMime {
  return (
    value === "audio/mpeg" || value === "audio/mp4" || value === "audio/ogg"
  );
}

/**
 * True when the audio path sits inside this exact page's folder.
 *
 * `isValidAudioPath` answers "is this a well-formed audio path", which any other
 * page's path also is - the folder segment is 32 hex characters either way. The
 * `assert_audio_path_scoped` trigger is what actually stops one page from
 * pointing at another's track, so that check exists only in the database and the
 * row mapper has to repeat it.
 *
 * It matters because of what happens next: a path that passes gets signed. Sign
 * it and the private bucket hands back a live URL for whichever page's folder is
 * named, so an unscoped row would leak that other page's audio to this page's
 * visitors. Checking shape and scope together means a row only ever produces a
 * URL for its own file.
 */
export function isAudioPathScopedTo(
  publicId: unknown,
  path: unknown,
): boolean {
  if (
    typeof publicId !== "string" ||
    !PUBLIC_ID_PATTERN.test(publicId) ||
    typeof path !== "string"
  ) {
    return false;
  }

  /*
   * Split rather than prefix-match. `path.startsWith(publicId + "/")` is not
   * enough: "<publicId>/../<otherId>/song.mp3" passes that test while naming a
   * different folder. That path is also rejected by AUDIO_PATH_PATTERN, so today
   * it cannot reach the signer - but relying on the caller having checked shape
   * first is a trap for whoever edits this next. Splitting makes the answer the
   * same either way: exactly two segments, the first being this page's id.
   */
  const segments = path.split("/");
  if (segments.length !== 2) return false;
  if (segments[0] !== publicId) return false;

  const fileName = segments[1];
  return (
    fileName.length > 0 &&
    !fileName.includes("\\") &&
    fileName !== ".." &&
    fileName !== "."
  );
}

/* -------------------------------------------------------------------------- */
/* Row shape                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One row as returned by the `get_birthday_page` function.
 *
 * Note the absence of `id`: the RPC never returns the internal surrogate key,
 * so it cannot leak into a page, a log, or an error message.
 */
export type BirthdayPageRow = {
  public_id: string;
  name: string;
  relationship: string;
  message: string;
  style: string;
  photo_paths: string[] | null;
  /** Private object path, or null. Never a URL: the bucket is private. */
  audio_path: string | null;
  audio_mime: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  /** Always in the future when this row is returned: the RPC filters on it. */
  expires_at: string;
  created_at: string;
};

export function isBirthdayStyleId(value: string): value is BirthdayStyleId {
  return BIRTHDAY_STYLES.some((style) => style.id === value);
}

export function isRelationship(value: string): value is Relationship {
  return (
    value === "Friend" ||
    value === "Best Friend" ||
    value === "Sister" ||
    value === "Brother" ||
    value === "Girlfriend" ||
    value === "Boyfriend" ||
    value === "Mother" ||
    value === "Father" ||
    value === "Other"
  );
}

/* -------------------------------------------------------------------------- */
/* Row -> render model                                                         */
/* -------------------------------------------------------------------------- */

export type PublicBirthday = {
  publicId: string;
  createdAt: string;
  draft: BirthdayDraft;
};

/**
 * Turns a database row back into the exact shape the Phase 4 preview renders.
 *
 * Reusing `BirthdayDraft` is what guarantees the public page is pixel-identical
 * to the preview: the same component tree, the same styles, the same
 * animations, the same reduced-motion handling. No second renderer exists.
 *
 * Anything unusable is dropped rather than invented. There is no fallback name
 * and no fallback message: a page either has real saved content or it is a
 * not-found.
 *
 * The two URL resolvers are deliberately separate arguments rather than one
 * function applied to both. Photos live in a public bucket, so their URLs are
 * permanent and can be derived from the path by anyone holding the page HTML.
 * Audio lives in a private bucket, so its URL has to be signed by the server and
 * expires; the caller passes that in. A single resolver would have to guess, and
 * guessing here would either leak a permanent audio URL or break every photo.
 */
export function rowToBirthday(
  row: BirthdayPageRow,
  publicUrlFor: (path: string) => string,
  audioUrlFor: (path: string) => string,
): PublicBirthday | null {
  const name = row.name.trim();
  const message = row.message.trim();

  if (!isValidPublicId(row.public_id)) return null;
  if (!isBirthdayStyleId(row.style)) return null;
  if (name.length === 0 || message.length === 0) return null;

  const relationship: Relationship | "" = isRelationship(row.relationship)
    ? row.relationship
    : "";

  const photos: PhotoItem[] = (row.photo_paths ?? [])
    .filter(
      (path) =>
        typeof path === "string" &&
        path.startsWith(`${row.public_id}/`) &&
        /^[\w.-]+$/.test(path.slice(row.public_id.length + 1)),
    )
    .map((path) => ({
      id: path,
      name: "",
      size: 0,
      url: publicUrlFor(path),
    }));

  // Re-validated against the storage policy's shape even though the row came from
  // our own table, because audio_path is the one field whose value would let a
  // page point outside its own folder. The trigger already forbids that, but the
  // trigger protects storage; this protects the rendering path.
  // Resolved once, then required to be non-empty. The resolver returns "" when
  // signing fails or the page has no usable life left, and an AudioItem with an
  // empty `url` would render a player that can never play and offer a "Tap to
  // play" button that does nothing. Dropping the track entirely is the honest
  // result: the page is still a complete page without it.
  const resolvedAudioUrl =
    isValidAudioPath(row.audio_path) &&
    isAudioMime(row.audio_mime) &&
    isAudioPathScopedTo(row.public_id, row.audio_path)
      ? audioUrlFor(row.audio_path)
      : "";

  const audio: AudioItem | null = resolvedAudioUrl
    ? {
        id: row.audio_path as string,
        name: "",
        size: 0,
        url: resolvedAudioUrl,
        mime: row.audio_mime as AudioMime,
      }
    : null;

  return {
    publicId: row.public_id,
    createdAt: row.created_at,
    draft: {
      birthdayPersonName: name,
      birthdayMonth: isValidMonth(row.birthday_month)
        ? (row.birthday_month as BirthdayMonth)
        : "",
      birthdayDay: isValidBirthdayDate(row.birthday_day, row.birthday_month)
        ? Number(row.birthday_day)
        : "",
      relationship,
      message,
      photos: photos.slice(0, PHOTO_MAX_COUNT),
      audio,
      style: row.style,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Validation before saving                                                    */
/* -------------------------------------------------------------------------- */

export type GenerateValidation =
  | { ok: true }
  | { ok: false; errors: DraftErrors; message: string };

/**
 * Characters that must never reach the database.
 *
 * Checked by code point rather than a character-class regex, so this file can
 * never itself contain an unprintable byte and there is no risk of a stray
 * literal changing what the pattern means.
 *
 * Tab (9), line feed (10) and carriage return (13) are allowed in a message
 * because people write messages with line breaks. They are not allowed in a
 * name. Every other C0 control, DEL, and the C1 range is rejected outright.
 */
function hasForbiddenControl(value: string, allowNewlines: boolean): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 9 || code === 10 || code === 13) {
      if (allowNewlines) continue;
      return true;
    }
    if (code < 0x20) return true; // remaining C0
    if (code === 0x7f) return true; // DEL
    if (code >= 0x80 && code <= 0x9f) return true; // C1
  }
  return false;
}

/**
 * Invisible characters that `String.prototype.trim` does not remove:
 * no-break space (160), the Unicode line/paragraph separators (8232/8233),
 * the narrow no-break space (8239) and a byte-order mark (65279).
 */
function hasInvisibleJunk(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 160 || code === 8232 || code === 8233 || code === 8239 || code === 65279) {
      return true;
    }
  }
  return false;
}

/**
 * Validation for the Generate action.
 *
 * Steps 1 and 3 already validated the name, relationship, message and style, so
 * this normally passes. It re-checks anyway because saving is the first moment
 * the data leaves the browser, and because the database enforces hard limits
 * that the form does not: an oversized name would be rejected by the table's
 * CHECK constraint, and surfacing that as a raw Postgres error is not
 * acceptable.
 *
 * Phase 6 widened this from a length check to a full pre-flight. The previous
 * version trusted that the form had already validated the enumerations, so a
 * hand-built draft could carry `relationship: "<script>"` or `style: "nope"` and
 * the failure only surfaced as a CHECK-constraint violation from Postgres. Every
 * value is now verified against the same allow-lists the database uses, and
 * every photo is checked for count, readability and byte size before any
 * bandwidth is spent.
 */
export function validateForGeneration(draft: BirthdayDraft): GenerateValidation {
  const errors: DraftErrors = {
    ...validateDetails(draft),
    ...validateStyle(draft),
    ...validateAudio(draft),
  };

  const name = draft.birthdayPersonName.trim();
  if (!errors.birthdayPersonName) {
    if (name.length > NAME_MAX_LENGTH) {
      errors.birthdayPersonName = `Keep the name under ${NAME_MAX_LENGTH} characters so it fits the page.`;
    } else if (hasForbiddenControl(name, false) || hasInvisibleJunk(name)) {
      errors.birthdayPersonName =
        "The name can only use normal letters, numbers and punctuation.";
    }
  }

  // The database CHECK permits exactly nine labels. Verifying the value here
  // means a malformed draft gets a field-level message instead of a rejected
  // INSERT.
  if (!errors.relationship && !isRelationship(draft.relationship)) {
    errors.relationship = "Choose one of the listed relationships.";
  }

  const message = draft.message.trim();
  if (!errors.message) {
    if (message.length > MESSAGE_MAX_LENGTH) {
      errors.message = `Keep the message under ${MESSAGE_MAX_LENGTH} characters.`;
    } else if (hasForbiddenControl(message, true) || hasInvisibleJunk(message)) {
      errors.message = "The message can only use normal text.";
    }
  }

  if (!errors.style && !isBirthdayStyleId(draft.style)) {
    errors.style = "Choose one style to continue.";
  }

  const photoProblem = validatePhotosForGeneration(draft.photos);
  if (photoProblem) {
    errors.photos = photoProblem;
  }

  // Photos are reported on their own rather than as "the first invalid field":
  // the fix is always to remove or replace one specific photo, and a generic
  // "check your details" message sends people hunting through Step 1.
  if (errors.photos) {
    return { ok: false, errors, message: errors.photos };
  }

  const firstError = Object.values(errors).find(Boolean);
  if (firstError) {
    return { ok: false, errors, message: firstError };
  }

  return { ok: true };
}

/**
 * Pre-flight for the photo batch.
 *
 * `size` is the browser's reported length, so it is a cheap early rejection
 * rather than the authority — `uploadPhotos` re-checks the bytes it actually
 * read. What this catches is the expensive case: a 10 MB-plus photo that would
 * otherwise be uploaded and then rejected by the bucket limit after the whole
 * transfer.
 */
function validatePhotosForGeneration(photos: readonly PhotoItem[]): string | undefined {
  if (photos.length > PHOTO_MAX_COUNT) {
    return `You can save up to ${PHOTO_MAX_COUNT} photos.`;
  }

  for (const [index, photo] of photos.entries()) {
    const position = index + 1;

    if (typeof photo?.url !== "string" || !photo.url.startsWith("blob:")) {
      return `Photo ${position} is no longer available. Remove it and add it again.`;
    }

    if (
      typeof photo.size !== "number" ||
      !Number.isFinite(photo.size) ||
      photo.size <= 0
    ) {
      return `Photo ${position} could not be read. Remove it and add it again.`;
    }

    if (photo.size > PHOTO_MAX_BYTES) {
      return `Photo ${position} is larger than ${PHOTO_SIZE_LABEL}. Remove it and pick a smaller one.`;
    }
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * User-facing failure reasons.
 *
 * Every value here is a sentence written for a person. Raw PostgREST or
 * Storage messages are logged for the developer and never shown, because they
 * can contain schema names, constraint names and project details.
 */
export type GenerateFailure =
  | "not-configured"
  | "invalid-data"
  | "network"
  | "upload-failed"
  | "save-failed"
  | "rate-limited"
  | "unknown";

export const GENERATE_FAILURE_MESSAGES: Record<GenerateFailure, string> = {
  "not-configured":
    "Saving is not available right now because this app is not connected to a database. Nothing was uploaded.",
  "invalid-data":
    "Some details still need attention before this birthday page can be created.",
  network:
    "We could not reach the server. Check your connection and try again — nothing was saved.",
  "upload-failed":
    "One of the photos could not be uploaded, so the birthday page was not created. Try again, or remove the photo.",
  "save-failed":
    "We could not create the birthday page just now. Nothing was saved — please try again.",
  "rate-limited":
    "Too many birthday pages have been created from this connection in a short time. Please wait a little while, then try again — nothing was saved.",
  unknown:
    "Something went wrong while creating the birthday page. Nothing was saved — please try again.",
};

export function describeFailure(failure: GenerateFailure): string {
  return GENERATE_FAILURE_MESSAGES[failure];
}

/**
 * SQLSTATE raised by the Phase 6 rate-limit triggers.
 *
 * Matching on the code rather than on message text means a wording change in the
 * migration can never silently turn a rate-limit rejection into a generic
 * "something went wrong". The message check stays as a fallback for the Storage
 * endpoint, which does not always surface the code.
 */
export const RATE_LIMIT_SQLSTATE = "BSL01";
const RATE_LIMIT_MESSAGE_FRAGMENT = "birthday-studio rate limit";

/** Maps a Supabase/PostgREST error onto a user-safe reason. */
export function classifyError(error: { message?: string; code?: string } | null): GenerateFailure {
  if (!error) return "unknown";

  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  // Checked first: a rate-limit rejection is not a fault, so it must never be
  // misreported as one of the "try again" messages above it.
  if (code === RATE_LIMIT_SQLSTATE || message.includes(RATE_LIMIT_MESSAGE_FRAGMENT)) {
    return "rate-limited";
  }

  if (code === "PGRST301" || message.includes("jwt") || message.includes("api key")) {
    return "not-configured";
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed")
  ) {
    return "network";
  }

  // 413 = Storage payload too large; 400/404/500 from the object endpoint.
  if (
    message.includes("exceeded the maximum allowed size") ||
    message.includes("payload too large") ||
    message.includes("413") ||
    message.includes("storage")
  ) {
    return "upload-failed";
  }

  return "save-failed";
}
