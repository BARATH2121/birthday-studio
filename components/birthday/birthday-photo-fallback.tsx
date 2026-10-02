/**
 * The visual shown where a photo would be.
 *
 * Two callers, one component, because both were drifting apart: the whole-gallery
 * empty state and a single tile whose image failed to load. The second case only
 * became reachable once the gallery moved to reusable frames, and it is the one
 * that actually shows up in the wild — a photo URL can break after the page is
 * shared, when the object was deleted by a cleanup sweep or a Storage hiccup
 * briefly served an error.
 *
 * Not an error message. The person looking at this is a birthday guest who does
 * not know or care what a CDN is, so the fallback stays on the same celebratory
 * register as the rest of the page and says nothing about failure.
 */
export default function BirthdayPhotoFallback({
  emoji,
  message,
  compact = false,
}: {
  emoji: string;
  /** Omit for the per-tile case, where there is nothing useful to say. */
  message?: string;
  /**
   * Tighter padding and a smaller mark, for a single square tile rather than the
   * full-width empty gallery. The full state's proportions look lost inside a
   * 150px box.
   */
  compact?: boolean;
}) {
  return (
    <div
      className={`bp-empty ${compact ? "bp-empty-compact" : ""}`}
      // The mark is decorative. Where there is a message the text carries the
      // meaning; where there is not, an emoji announced by a screen reader is
      // noise in the middle of a photo grid.
      aria-hidden={message ? undefined : true}
    >
      <span className={`bp-empty-mark ${compact ? "bp-empty-mark-sm" : ""}`} aria-hidden="true">
        {emoji}
      </span>

      {message ? <p className="bp-empty-text">{message}</p> : null}
    </div>
  );
}