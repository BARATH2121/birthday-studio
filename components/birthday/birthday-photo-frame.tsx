"use client";

import { useState } from "react";
import type { PhotoItem } from "@/lib/birthday";
import BirthdayPhotoFallback from "./birthday-photo-fallback";

/**
 * One photo tile: the frame, the image, and what to show when there isn't one.
 *
 * A client component purely to hold per-tile load-failure state. That state
 * cannot live in the parent: the gallery is a server component that renders many
 * tiles at once, and lifting "which of these twenty images broke" up to it would
 * mean shipping the whole gallery's worth of image state to the browser as
 * props. Keeping it here is the cheapest place for it.
 *
 * The frame element carries the geometry: a rounded card with no aspect ratio
 * of its own, so every photo renders at its original aspect ratio. Only the
 * grid's column span differs by `data-count`, and that is expressed in CSS
 * keyed off the value, so this component does not try to know which layout it
 * has landed in. Marking it as a plain `figure` with no aspect ratio of its own
 * keeps a change to that CSS from requiring a change here.
 */
export default function BirthdayPhotoFrame({
  photo,
  alt,
  emoji,
  priority = false,
}: {
  photo: PhotoItem;
  alt: string;
  /** Used for the fallback mark, so a broken tile matches the page's style. */
  emoji: string;
  /** Set on the lead tile so the browser is not told to lazy-load it. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  /*
   * Reset when the URL changes. Without this, a gallery whose photos are swapped
   * out while it is mounted would leave every previously-failed tile showing a
   * fallback for an image that is now fine. React keeps this component's state
   * across a prop change precisely because the key is the photo id.
   */
  const [failedUrl, setFailedUrl] = useState(photo.url);
  if (failedUrl !== photo.url) {
    setFailedUrl(photo.url);
    setFailed(false);
  }

  return (
    <figure className="bp-photo">
      {failed ? (
        <BirthdayPhotoFallback emoji={emoji} compact />
      ) : (
        // A plain <img> instead of next/image `fill`: the uploads have unknown
        // intrinsic dimensions, and the frame must never impose a box or crop on
        // them. `fill` absolutely positioned the image inside an aspect-ratio
        // frame and, together with object-fit: cover, cropped every photo to the
        // frame's shape. Without `fill` the image flows at its natural aspect
        // ratio (sized in CSS) and is never clipped or distorted.
        // eslint-disable-next-line @next/next/no-img-element -- intrinsic dimensions are unknown per upload; next/image `fill` is the fixed-box crop this change removes
        <img
          src={photo.url}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          // A blank image that never resolves reads worse than the fallback.
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}