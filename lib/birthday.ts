import {
  BIRTHDAY_TIME_ZONE,
  MONTHS,
  computeExpiresAt,
  daysInMonth,
  formatBirthdayDate,
  isValidBirthdayDate,
  isValidMonth,
  type BirthdayMonth,
} from "./birthday-date";

export {
  BIRTHDAY_TIME_ZONE,
  MONTHS,
  computeExpiresAt,
  daysInMonth,
  formatBirthdayDate,
  isValidBirthdayDate,
};
export type { BirthdayMonth };

/**
 * Month names paired with their numbers, ready for a `<select>`.
 *
 * The name is the label because it is what the person reads; the number is the
 * value because that is what the database stores.
 */
export const MONTH_OPTIONS = MONTHS.map((month) => ({
  value: String(month.value),
  label: month.name,
}));

/**
 * The day numbers still selectable for `month`.
 *
 * February stops at 29 even outside a leap year. That is deliberate: 29 February
 * is a real birthday, and the database only ever stores the month and day, so it
 * has no way to record which years it is 28th. The expiry rule resolves that at
 * read time — see `computeExpiresAt` — and the select must not reject a date the
 * rest of the system is willing to accept.
 *
 * An unset month falls back to 31 rather than empty, so the day control stays
 * usable while the month is still being chosen.
 */
export function birthdayDayOptions(month: BirthdayMonth | ""): number[] {
  const last = isValidMonth(month) ? daysInMonth(month) : 31;
  return Array.from({ length: last }, (_, index) => index + 1);
}

export const RELATIONSHIPS = [
  "Friend",
  "Best Friend",
  "Sister",
  "Brother",
  "Girlfriend",
  "Boyfriend",
  "Mother",
  "Father",
  "Other",
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export type BirthdayStyleId =
  | "romantic"
  | "cute-colorful"
  | "elegant"
  | "fun-crazy"
  | "cinematic";

export type BirthdayStyle = {
  id: BirthdayStyleId;
  name: string;
  emoji: string;
  tagline: string;
  gradient: string;
};

export const BIRTHDAY_STYLES: readonly BirthdayStyle[] = [
  {
    id: "romantic",
    name: "Romantic",
    emoji: "❤️",
    tagline: "Soft pinks, petals and candlelight",
    gradient:
      "linear-gradient(140deg, var(--color-blush-500) 0%, var(--color-grape-500) 100%)",
  },
  {
    id: "cute-colorful",
    name: "Cute & Colorful",
    emoji: "🎀",
    tagline: "Playful pastels and cheerful pops",
    gradient:
      "linear-gradient(140deg, var(--color-blush-400) 0%, var(--color-azure-400) 100%)",
  },
  {
    id: "elegant",
    name: "Elegant",
    emoji: "✨",
    tagline: "Deep violets and quiet light",
    gradient:
      "linear-gradient(140deg, var(--color-grape-400) 0%, var(--color-azure-500) 100%)",
  },
  {
    id: "fun-crazy",
    name: "Fun & Crazy",
    emoji: "🎉",
    tagline: "Confetti, colour and motion",
    gradient:
      "linear-gradient(140deg, var(--color-blush-500) 0%, var(--color-azure-500) 100%)",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    emoji: "🎬",
    tagline: "Moody frames and dramatic light",
    gradient:
      "linear-gradient(140deg, var(--color-night-600) 0%, var(--color-azure-400) 100%)",
  },
];

export type PhotoItem = {
  id: string;
  name: string;
  size: number;
  url: string;
};

export type AudioMime = "audio/mpeg" | "audio/mp4" | "audio/ogg";

/**
 * Optional background track. One per page, or none.
 *
 * `url` is an object URL for the local preview only; it is never stored or
 * uploaded. The published page gets a short-lived signed URL instead.
 */
export type AudioItem = {
  id: string;
  name: string;
  size: number;
  url: string;
  mime: AudioMime;
};

export type BirthdayDraft = {
  birthdayPersonName: string;
  birthdayMonth: BirthdayMonth | "";
  birthdayDay: number | "";
  relationship: Relationship | "";
  message: string;
  photos: PhotoItem[];
  audio: AudioItem | null;
  style: BirthdayStyleId | "";
};

export const EMPTY_DRAFT: BirthdayDraft = {
  birthdayPersonName: "",
  birthdayMonth: "",
  birthdayDay: "",
  relationship: "",
  message: "",
  photos: [],
  audio: null,
  style: "",
};

export const MESSAGE_MAX_LENGTH = 500;

export const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const PHOTO_MAX_COUNT = 20;

export const PHOTO_SIZE_LABEL = "10 MB";

/**
 * Audio is matched on the file EXTENSION, not on `file.type`.
 *
 * Browsers report `.m4a` inconsistently: some say `audio/mp4`, some
 * `audio/x-m4a`, some `audio/mpeg`, and Safari has been known to say
 * `application/octet-stream` for a perfectly valid file. Trusting the reported
 * type would mean a legitimate upload rejected here and again by the database
 * constraint, so the extension is the single source of truth and the type is
 * derived from it. The three extensions below are exactly the three the storage
 * policy accepts, so nothing can be accepted here and refused there.
 */
export const AUDIO_EXTENSIONS = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
} as const satisfies Record<string, AudioMime>;

export type AudioExtension = keyof typeof AUDIO_EXTENSIONS;

export const AUDIO_ACCEPT = Object.keys(AUDIO_EXTENSIONS)
  .map((extension) => `.${extension}`)
  .join(",");

export const AUDIO_TYPES = Object.values(AUDIO_EXTENSIONS);

export const AUDIO_MAX_BYTES = 5 * 1024 * 1024;

export const AUDIO_SIZE_LABEL = "5 MB";

/** The canonical MIME for an audio file, or null if the extension is not one of ours. */
export function audioMimeForFile(file: File): AudioMime | null {
  const match = /^(.+)\.([a-z0-9]+)$/i.exec(file.name);
  if (!match) return null;

  /*
   * `(.+)` rather than `.*`, so a file named exactly ".mp3" is refused. That name
   * has an extension and no stem, and it is the shape a double-extension trick
   * takes: ".mp3" is not something anyone saves a song as, but accepting it would
   * mean the displayed name and the object written to Storage disagree about what
   * the file is.
   */
  if (match[1].trim().length === 0) return null;

  const extension = match[2].toLowerCase() as AudioExtension;
  return AUDIO_EXTENSIONS[extension] ?? null;
}

export const CREATE_STEPS = [
  {
    id: 1,
    name: "Details",
    title: "Birthday Person Details",
    description:
      "Only you know these details. Nothing is uploaded or shared yet.",
  },
  {
    id: 2,
    name: "Photos",
    title: "Add their favorite photos",
    description:
      "Choose photos from this device. They stay in your browser for now — nothing is uploaded.",
  },
  {
    id: 3,
    name: "Style",
    title: "Choose a Style",
    description:
      "Pick the mood that fits your relationship. Every style reshapes colors, motion and type.",
  },
  {
    id: 4,
    name: "Preview",
    title: "Your Birthday Preview",
    description:
      "This is how the birthday page will look. It is a preview only - nothing has been uploaded, saved or published.",
  },
] as const;

export type FieldName = keyof BirthdayDraft;

export type DraftErrorField =
  | "birthdayPersonName"
  | "birthdayMonth"
  | "birthdayDay"
  | "relationship"
  | "message"
  | "photos"
  | "audio"
  | "style";

export type DraftErrors = Partial<Record<DraftErrorField, string>>;

/**
 * The order the create flow jumps to when it cannot proceed.
 *
 * The birthday date sits directly after the name: it is the second thing that
 * has to be true before a page can exist at all, and leaving it until step 4
 * would mean discovering an invalid page after uploading twenty photos.
 */
export const FIELD_PRIORITY: readonly FieldName[] = [
  "birthdayPersonName",
  "birthdayMonth",
  "birthdayDay",
  "relationship",
  "message",
  "style",
];

export const FIELD_IDS: Record<FieldName, string> = {
  birthdayPersonName: "bs-name",
  birthdayMonth: "bs-birthday-month",
  birthdayDay: "bs-birthday-day",
  relationship: "bs-relationship",
  message: "bs-message",
  photos: "bs-photos",
  audio: "bs-audio",
  style: "bs-style",
};

export function styleFieldId(id: BirthdayStyleId): string {
  return `${FIELD_IDS.style}-${id}`;
}

export function validateDetails(draft: BirthdayDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.birthdayPersonName.trim().length === 0) {
    errors.birthdayPersonName = "Enter their name to continue.";
  }
  if (!isValidMonth(draft.birthdayMonth)) {
    errors.birthdayMonth = "Choose the month of their birthday.";
  }
  // Checked against the month rather than on its own, so 31 April cannot be
  // picked. February is allowed to the 29th so a leap-day birthday is a real
  // option, and it is resolved at expiry time instead of being refused here.
  if (!isValidBirthdayDate(draft.birthdayDay, draft.birthdayMonth)) {
    errors.birthdayDay = draft.birthdayMonth
      ? "That day doesn't exist in that month."
      : "Choose the day of their birthday.";
  }
  if (draft.relationship === "") {
    errors.relationship = "Choose how the two of you are related.";
  }
  if (draft.message.trim().length === 0) {
    errors.message = "Write a short birthday message.";
  }
  return errors;
}

/**
 * Optional, so it never blocks the flow. Anything already attached must be
 * valid, because a page that fails on an oversized or unsupported track is a
 * worse outcome than the picker being strict in the first place.
 */
export function validateAudio(draft: BirthdayDraft): DraftErrors {
  if (draft.audio === null) return {};
  // Zero as well as oversized. A zero-length "track" would upload happily and
  // produce an <audio> element that can never play, so the player would render a
  // control promising sound that does not exist. The picker and the upload both
  // refuse it too; this is the third place that has to agree.
  if (draft.audio.size <= 0) {
    return { audio: "That file is empty. Choose a different one." };
  }
  if (draft.audio.size > AUDIO_MAX_BYTES) {
    return {
      audio: `That track is larger than ${AUDIO_SIZE_LABEL}. Choose a smaller one.`,
    };
  }
  return {};
}

export function validateStyle(draft: BirthdayDraft): DraftErrors {
  if (draft.style === "") {
    return { style: "Choose one style to continue." };
  }
  return {};
}

/**
 * Builds a short dedication line from the selected relationship only.
 * No personal facts are added: "Other" has no possessive form, so it
 * falls back to a neutral line.
 */
export function relationshipPhrase(relationship: Relationship | ""): string {
  if (relationship === "" || relationship === "Other") {
    return "Made especially for you";
  }
  return `Made especially for my ${relationship.toLowerCase()}`;
}
