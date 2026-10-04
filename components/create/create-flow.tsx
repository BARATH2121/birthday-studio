"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BirthdayPage from "@/components/birthday/birthday-page";
import GenerateBirthday from "./generate-birthday";
import ShareSuccess from "./share-success";
import StepDetails from "./step-details";
import StepAudio from "./step-audio";
import StepIndicator from "./step-indicator";
import StepPhotos from "./step-photos";
import StepStyle from "./step-style";
import {
  AUDIO_MAX_BYTES,
  AUDIO_SIZE_LABEL,
  CREATE_STEPS,
  EMPTY_DRAFT,
  FIELD_IDS,
  FIELD_PRIORITY,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  PHOTO_SIZE_LABEL,
  PHOTO_TYPES,
  audioMimeForFile,
  styleFieldId,
  validateDetails,
  validateStyle,
  type BirthdayDraft,
  type BirthdayStyleId,
  type AudioItem,
  type DraftErrorField,
  type DraftErrors,
  type FieldName,
  type PhotoItem,
} from "@/lib/birthday";

function photoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `photo-${Math.random().toString(36).slice(2)}`;
}

export default function CreateFlow() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BirthdayDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Audio is optional, so its message is never promoted into the blocking error
  // set that drives `showErrors`. It is shown next to the picker on its own and
  // never stops the person moving on.
  const [audioError, setAudioError] = useState<string | null>(null);
  // Set once a page has actually been created. While this is null the preview
  // and the Generate button are shown; once it holds an id the success screen
  // replaces them. Owning the state here (rather than inside GenerateBirthday)
  // is what lets the success screen take the preview's place in Step 4.
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const photosRef = useRef<PhotoItem[]>(EMPTY_DRAFT.photos);
  // Tracked separately because the audio track is a single replaceable blob
  // rather than a list, and is released the same way on unmount.
  const audioRef = useRef<AudioItem | null>(null);

  useEffect(() => {
    photosRef.current = draft.photos;
  }, [draft.photos]);

  useEffect(() => {
    audioRef.current = draft.audio;
  }, [draft.audio]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.url);
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const detailErrors = useMemo(() => validateDetails(draft), [draft]);
  const styleErrors = useMemo(() => validateStyle(draft), [draft]);

  const patch = (values: Partial<BirthdayDraft>) => {
    setDraft((current) => ({ ...current, ...values }));
  };

  const markTouched = (field: FieldName) => {
    setTouched((current) =>
      current[field] ? current : { ...current, [field]: true },
    );
  };

  const errorFor = (errors: DraftErrors, field: DraftErrorField) =>
    showErrors || touched[field] ? errors[field] : undefined;

  const focusField = (field: FieldName) => {
    const id = field === "style" ? styleFieldId("romantic") : FIELD_IDS[field];
    document.getElementById(id)?.focus();
  };

  const goNext = () => {
    const errors = step === 1 ? detailErrors : step === 3 ? styleErrors : {};
    const invalid = FIELD_PRIORITY.find((field) => errors[field as DraftErrorField]);

    if (invalid) {
      setShowErrors(true);
      focusField(invalid);
      return;
    }

    setShowErrors(false);
    setStep((current) => Math.min(current + 1, CREATE_STEPS.length));
  };

  const goBack = () => {
    setShowErrors(false);
    // Leaving Step 4 discards the success state so the preview returns. The
    // already-created page keeps existing and its link keeps working; this only
    // forgets that we are looking at it.
    setPublishedId(null);
    setStep((current) => Math.max(current - 1, 1));
  };

  const goEdit = () => {
    setShowErrors(false);
    setPublishedId(null);
    setStep(1);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const rejected: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name} is not a JPG, PNG or WEBP image.`);
        continue;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        rejected.push(`${file.name} is larger than ${PHOTO_SIZE_LABEL}.`);
        continue;
      }
      accepted.push(file);
    }

    const room = Math.max(PHOTO_MAX_COUNT - draft.photos.length, 0);
    const taking = accepted.slice(0, room);

    if (accepted.length > room) {
      rejected.push(`You can add up to ${PHOTO_MAX_COUNT} photos.`);
    }

    if (taking.length > 0) {
      const items: PhotoItem[] = taking.map((file) => ({
        id: photoId(),
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
      }));
      setDraft((current) => ({ ...current, photos: [...current.photos, ...items] }));
    }

    setPhotoError(rejected.length > 0 ? rejected.join(" ") : null);
  };

  const removePhoto = (id: string) => {
    const target = draft.photos.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.url);
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.id !== id),
    }));
  };

  const chooseAudio = (file: File | null) => {
    setAudioError(null);

    if (!file) {
      if (draft.audio) URL.revokeObjectURL(draft.audio.url);
      setDraft((current) => ({ ...current, audio: null }));
      return;
    }

    // Type comes from the extension, not `file.type`. Browsers report `.m4a` as
    // anything from `audio/mp4` to `audio/x-m4a` or an empty string, and the
    // database only accepts three exact values, so trusting the header would
    // reject valid files on some devices and let odd ones through on others.
    const mime = audioMimeForFile(file);
    if (!mime) {
      // The previously chosen track is left intact, including its object URL.
      // Revoking it before the replacement is known to be good would leave the
      // existing chip pointing at a dead blob that can no longer be previewed or
      // uploaded.
      setAudioError("Choose an MP3, M4A or OGG audio file.");
      return;
    }

    if (file.size <= 0 || file.size > AUDIO_MAX_BYTES) {
      setAudioError(`That track is larger than ${AUDIO_SIZE_LABEL}. Choose a smaller one.`);
      return;
    }

    const url = URL.createObjectURL(file);
    const previous = draft.audio;

    setDraft((current) => ({
      ...current,
      audio: { id: photoId(), name: file.name, size: file.size, mime, url },
    }));

    // Only now that a valid replacement exists is the old blob safe to release.
    if (previous) URL.revokeObjectURL(previous.url);
  };

  const current = CREATE_STEPS.find((item) => item.id === step) ?? CREATE_STEPS[0];
  const isPreview = step === CREATE_STEPS.length;
  const canGoBack = step > 1;

  const nextLabel =
    isPreview
      ? "Edit information"
      : step === 2 && draft.photos.length === 0
        ? "Continue without photos"
        : "Continue";

  const primaryAction = isPreview ? goEdit : goNext;

  return (
    <div
      className="bs-shell flex-1 pb-36 pt-8 sm:pb-32 sm:pt-12"
      data-bstyle={draft.style || undefined}
    >
      <div className="mx-auto w-full max-w-4xl">
        <StepIndicator current={step} />

        <div
          className={
            isPreview
              ? "mt-6 sm:mt-8"
              : "bs-card bs-sheen bs-hairline-top mt-6 rounded-[1.75rem] p-5 sm:mt-8 sm:p-8"
          }
        >
          {publishedId ? null : (
            <div>
              <p className="bs-eyebrow">
                Step {current.id} of {CREATE_STEPS.length}
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-5 text-[1.75rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[2.5rem]"
              >
                {current.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                {current.description}
              </p>
            </div>
          )}

          <div className="mt-8">
            {step === 1 ? (
              <StepDetails
                draft={draft}
                errors={{
                  birthdayPersonName: errorFor(
                    detailErrors,
                    "birthdayPersonName",
                  ),
                  relationship: errorFor(detailErrors, "relationship"),
                  message: errorFor(detailErrors, "message"),
                }}
                onChange={patch}
                onBlur={markTouched}
              />
            ) : null}

            {step === 2 ? (
              <div className="grid gap-8">
                <StepPhotos
                  photos={draft.photos}
                  error={photoError}
                  onAdd={addPhotos}
                  onRemove={removePhoto}
                  onDismissError={() => setPhotoError(null)}
                />

                <StepAudio
                  audio={draft.audio}
                  error={audioError}
                  onSelect={chooseAudio}
                  onDismissError={() => setAudioError(null)}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <StepStyle
                value={draft.style}
                error={errorFor(styleErrors, "style")}
                onChange={(value: BirthdayStyleId) => patch({ style: value })}
                onBlur={() => markTouched("style")}
              />
            ) : null}

            {isPreview ? (
              publishedId ? (
                <ShareSuccess publicId={publishedId} />
              ) : (
                <>
                  <div className="bp-frame bp-fade">
                    <BirthdayPage draft={draft} />
                  </div>

                  {/*
                    The Generate action sits inside Step 4, under the preview,
                    rather than in the sticky bar. The bar is navigation
                    (Back / Edit information) and the Generate button is a
                    commitment with a real network side effect, so it is
                    styled and announced differently instead of competing with
                    navigation.
                  */}
                  <GenerateBirthday
                    draft={draft}
                    onPublished={setPublishedId}
                  />
                </>
              )
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 -mt-2 pt-6">
          <div className="flex flex-col-reverse gap-3 rounded-[1.5rem] border border-white/8 bg-night-950/82 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:py-2 sm:pl-5 sm:pr-2">
            {canGoBack ? (
              <button
                type="button"
                onClick={goBack}
                className="bs-btn bs-btn-ghost w-full px-5 py-3.5 text-sm sm:w-auto"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-4"
                  focusable="false"
                >
                  <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
                </svg>
                Back
              </button>
            ) : (
              <span aria-hidden="true" className="hidden sm:block" />
            )}

            <button
              type="button"
              onClick={primaryAction}
              className="bs-btn bs-btn-primary w-full px-6 py-3.5 text-sm sm:w-auto"
            >
              {nextLabel}
              {isPreview ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-4"
                  focusable="false"
                >
                  <path d="m4 20 4.5-1.5L19 8a2.1 2.1 0 0 0-3-3L5.5 15.5 4 20Z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-4"
                  focusable="false"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
