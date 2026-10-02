"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isValidPublicId } from "@/lib/birthday-page";

type CopyState = "idle" | "copied" | "failed";

/**
 * The origin, read without an effect.
 *
 * `useSyncExternalStore` is the right tool here: the origin is browser state,
 * and the hook lets the server render a stable "" snapshot and the client swap
 * in the real origin after hydration. An effect that called setState would
 * instead cause an extra render pass on every mount, and reading
 * `window.location` directly during render would break SSR.
 *
 * subscribe is a no-op because the origin cannot change without a navigation,
 * which remounts this screen anyway.
 */
const subscribeToOrigin = () => () => {};
const readOrigin = () => window.location.origin;
const readServerOrigin = () => "";

/**
 * Success screen shown after a birthday page is created.
 *
 * The URL is derived from the origin the creator is actually looking at, so the
 * button always copies a working address. Nothing here is a placeholder, and
 * nothing is claimed to be permanent.
 */
export default function ShareSuccess({ publicId }: { publicId: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    readOrigin,
    readServerOrigin,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Defensive: a malformed id must never produce a link that looks real.
  const valid = isValidPublicId(publicId);
  const href = valid ? `/birthday/${publicId}` : "/";
  const absoluteUrl = origin && valid ? `${origin}${href}` : "";

  const flash = useCallback((next: CopyState) => {
    setCopyState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 2600);
  }, []);

  const copy = useCallback(async () => {
    if (!absoluteUrl) return;

    // Preferred path: the async Clipboard API.
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        flash("copied");
        return;
      } catch {
        // Permission denied or a non-secure context. Fall through.
      }
    }

    // Fallback 1: a hidden textarea plus execCommand. Still no dependency.
    try {
      const area = document.createElement("textarea");
      area.value = absoluteUrl;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      area.style.pointerEvents = "none";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      flash(ok ? "copied" : "failed");
      return;
    } catch {
      // Fall through to the manual case.
    }

    // Fallback 2: the URL is rendered in a readonly input, so the visitor can
    // still select and copy it by hand. Never leave them with nothing.
    flash("failed");
  }, [absoluteUrl, flash]);

  if (!valid) {
    return (
      <section className="bs-card bp-reveal rounded-[1.75rem] p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          We could not confirm the new link
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          The page may not have been created correctly. Please start again from
          the preview.
        </p>
      </section>
    );
  }

  return (
    <section
      className="bs-card bp-reveal bp-d1 rounded-[1.75rem] p-6 sm:p-8"
      aria-labelledby="share-heading"
    >
      <p className="bs-eyebrow">Saved</p>

      <h1
        id="share-heading"
        className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl"
      >
        Your Birthday Surprise is Ready!
      </h1>

      <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
        The birthday page has been created. Send this link to the person whose
        birthday it is — it is the only thing they need to open it.
      </p>

      <div className="bs-share-url">
        <label htmlFor="share-url" className="bs-share-url-label">
          Shareable link
        </label>
        <input
          id="share-url"
          data-testid="share-url"
          className="bs-share-url-input"
          value={absoluteUrl}
          readOnly
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>

      <p aria-live="polite" className="bs-share-status" data-testid="copy-status">
        {copyState === "copied" ? "Link copied to your clipboard." : null}
        {copyState === "failed"
          ? "Copying was blocked by the browser. Select the link above and copy it manually."
          : null}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={copy}
          data-testid="copy-link"
          className="bs-btn bs-btn-primary sm:w-auto"
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
            <rect x="9" y="9" width="12" height="12" rx="2.5" />
            <path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H15" />
          </svg>
          {copyState === "copied" ? "Copied" : "Copy link"}
        </button>

        <Link
          href={href}
          data-testid="open-birthday"
          className="bs-btn bs-btn-ghost sm:w-auto"
        >
          Open Birthday
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
            <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
          </svg>
        </Link>

        {/*
          A plain wa.me share link. No API, no account connection, no automated
          send: it opens the visitor's own WhatsApp with the text pre-filled and
          they press send themselves.
        */}
        <a
          href={whatsappUrl(absoluteUrl)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="whatsapp-share"
          className="bs-btn bs-btn-ghost sm:w-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="size-4"
            focusable="false"
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24Zm-2.6 4.03c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.59.13.16 1.75 2.79 4.32 3.8 2.14.84 2.57.67 3.03.63.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.48-.73-1.71-.81-.23-.09-.4-.13-.56.12-.17.25-.64.81-.79.98-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.47Z" />
          </svg>
          Share on WhatsApp
        </a>
      </div>

      {/*
        Honest about the limits. The link is the page's only key, photos are
        public to anyone who has it, and there is no owner account that could
        bring the page back if it is lost.
      */}
      <div className="bs-share-note">
        <p>
          <strong>Keep this link safe.</strong> Anyone who has it can open the
          birthday page and see the photos. There is no password, so you cannot
          make it private later.
        </p>
        <p>
          <strong>No account is attached.</strong> Birthday Studio does not keep
          a copy of your details or a way to restore this page, so save the link
          somewhere you will find it. Anyone with it can keep sharing it.
        </p>
      </div>

      <div className="mt-6">
        <Link href="/create" className="bs-btn bs-btn-ghost w-full sm:w-auto">
          Create another birthday
        </Link>
      </div>
    </section>
  );
}

function whatsappUrl(url: string): string {
  const text = url
    ? `I made you a birthday surprise! Open it here: ${url}`
    : "I made you a birthday surprise!";
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
