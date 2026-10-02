"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveBirthdayPage } from "@/lib/save-birthday";
import {
  describeFailure,
  validateForGeneration,
  type GenerateFailure,
} from "@/lib/birthday-page";
import type { BirthdayDraft } from "@/lib/birthday";

/**
 * The Generate action for Step 4.
 *
 * Owns the save state machine, but deliberately does not own the success
 * screen. It reports the new public id upwards so the surrounding flow can put
 * the success screen where the preview used to be, which is why this renders
 * nothing at all once it has succeeded.
 */
export default function GenerateBirthday({
  draft,
  onPublished,
}: {
  draft: BirthdayDraft;
  onPublished: (publicId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<GenerateFailure | null>(null);

  // A ref guard, not just a disabled button.
  //
  // React state updates are asynchronous, so two clicks dispatched in the same
  // tick would both read busy === false and both would start saving. That would
  // create two birthday pages — two uploads, two rows — from one click. The ref
  // flips synchronously, so the second call is rejected before any request is
  // made.
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const generate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    // Validate before the ref is released so a validation failure does not
    // leave the button stuck in a loading state.
    const validation = validateForGeneration(draft);
    if (!validation.ok) {
      inFlight.current = false;
      setFailure("invalid-data");
      return;
    }

    setFailure(null);
    setBusy(true);

    const result = await saveBirthdayPage(draft);

    if (!mounted.current) return;

    if (result.ok) {
      setBusy(false);
      onPublished(result.publicId);
    } else {
      setFailure(result.failure);
      setBusy(false);
    }

    inFlight.current = false;
  }, [draft, onPublished]);

  const photoCount = draft.photos.length;

  return (
    <div className="bp-generate">
      {/*
        One live region for the whole outcome. Announcements are short and
        specific so a screen-reader user learns that the page was created, or
        what went wrong, without hunting for the change.
      */}
      <p aria-live="polite" className="sr-only">
        {busy
          ? "Creating your birthday page. Please wait."
          : failure
            ? describeFailure(failure)
            : ""}
      </p>

      {failure ? (
        <p className="bs-alert" role="alert" data-testid="generate-error">
          <span aria-hidden="true" className="bs-alert-mark">
            !
          </span>
          <span>
            {describeFailure(failure)}
            {failure === "invalid-data"
              ? " Use Edit information to review the details."
              : ""}
          </span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={generate}
        disabled={busy}
        aria-busy={busy}
        data-testid="generate-birthday"
        className="bs-btn bs-btn-primary bs-btn-generate w-full"
      >
        {busy ? (
          <>
            <span className="bs-spinner" aria-hidden="true" />
            Creating your birthday page…
          </>
        ) : (
          <>
            Generate Birthday
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
              <path d="M12 3v18M3 12h18" />
            </svg>
          </>
        )}
      </button>

      {/*
        Stated plainly, before the click, because it is the part people get
        wrong: a shared link is the only key, and it exposes the photos.
      */}
      <p className="bs-hint bs-generate-hint">
        Generating creates a permanent page and uploads{" "}
        {photoCount > 0
          ? `${photoCount} photo${photoCount === 1 ? "" : "s"}`
          : "no photos"}{" "}
        so it can be shared. Anyone with the link can open the page and see the
        photos. There is no password and no sign-in.
      </p>
    </div>
  );
}
