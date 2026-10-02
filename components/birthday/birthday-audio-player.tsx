"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BirthdayAudioPlayerProps = {
  /**
   * A server-issued signed URL, already scoped to the private audio bucket and
   * already bounded by the page's own expiry.
   */
  src: string;
  title: string;
};

/**
 * Autoplaying audio with a tap-to-play fallback.
 *
 * Every mobile browser refuses unmuted autoplay before the person has interacted
 * with the page, so the refused path here is the common case on phones rather
 * than an edge case. It is treated as a normal, quiet state: one small button,
 * no error text, no message explaining anything.
 *
 * There is deliberately no "autoplay silently then unmute" mode. It plays, and
 * the page appears to have sound while emitting none, which is a worse
 * experience than not playing at all.
 */
export default function BirthdayAudioPlayer({ src, title }: BirthdayAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const attemptPlay = useCallback(async (element: HTMLAudioElement) => {
    try {
      await element.play();
      setPlaying(true);
      setNeedsGesture(false);
    } catch {
      setPlaying(false);
      /*
       * Two different failures used to be reported as one. A refused autoplay is
       * recoverable by a tap, so that becomes "Tap to play". A load or decode
       * failure is not: no tap will ever make those bytes play, so the control
       * is withdrawn entirely rather than left as a dead button.
       *
       * The media error is read from the element here because it cannot be
       * trusted to arrive as an event: the <audio> starts loading while the HTML
       * is still parsing, so a fast 404 sets element.error before hydration has
       * attached onError. Listening alone left the button showing for a URL
       * that could never play.
       */
      if (element.error) {
        setFailed(true);
        setNeedsGesture(false);
      } else {
        setNeedsGesture(true);
      }
    }
  }, []);

  /*
   * Reset when the URL changes, during render rather than in an effect: the
   * previous URL may be the one that failed, and React's recommended way to
   * adjust state for a changed prop is to do it here. It matches the per-image
   * frame in birthday-photo-frame.tsx, which resets the same way.
   */
  const [stateUrl, setStateUrl] = useState(src);
  if (stateUrl !== src) {
    setStateUrl(src);
    setFailed(false);
    setNeedsGesture(false);
  }

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    // Guarded rather than assumed. Browsers may autoplay policy may leave the
    // promise unsettled if the page is not yet visible, and the state would then
    // never update at all.
    let cancelled = false;

    if (element.paused) {
      void attemptPlay(element).then(() => {
        if (cancelled) element.pause();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [attemptPlay, src]);

  const toggle = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;

    if (element.paused) {
      void attemptPlay(element);
    } else {
      element.pause();
    }
  }, [attemptPlay]);

  return (
    <div className="flex shrink-0 items-center">
      {/*
        Mounted in every state, including the one where autoplay was refused.
        Returning early for `needsGesture` unmounted this element, which nulled
        the ref and left "Tap to play" calling toggle() against a null element:
        the button silently did nothing. The element has to exist before any
        gesture so that the gesture has something to act on.
      */}
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        loop
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          // The URL itself is unusable, so there is nothing for a tap to fix.
          // Offering a play button here would be another dead control.
          setFailed(true);
          setPlaying(false);
          setNeedsGesture(false);
        }}
        className="sr-only"
        aria-label={title}
      />
      {failed ? null : needsGesture ? (
        <button
          type="button"
          onClick={toggle}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 text-xs text-white/75 transition-colors duration-200 hover:border-blush-400/60 hover:text-white"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="size-3"
            focusable="false"
          >
            <path d="M6 4.5v11l9-5.5-9-5.5Z" />
          </svg>
          Tap to play
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          className="grid size-7 place-items-center rounded-full border border-white/12 bg-white/6 text-white/75 transition-colors duration-200 hover:border-blush-400/60 hover:text-white"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="size-3"
            focusable="false"
          >
            {playing ? (
              <path d="M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" />
            ) : (
              <path d="M6 4.5v11l9-5.5-9-5.5Z" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}