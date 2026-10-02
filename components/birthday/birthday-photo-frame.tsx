"use client";

import { useState } from "react";
import Image from "next/image";
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
 * The frame element carries all the geometry. Aspect ratios differ by gallery
 * shape -- square by default, 4:3 for a lone photo, 16:9 for the lead tile in
 * some counts -- and those are expressed in CSS keyed off `data-count`, so this
 * component does not try to know which layout it has landed in. Marking it as a
 * plain `figure` with no aspect ratio of its own keeps a change to that CSS from
 * requiring a change here.
 */
export default function BirthdayPhotoFrame({
  photo,
  alt,
  emoji,
  sizes,
  priority = false,
}: {
  photo: PhotoItem;
  alt: string;
  /** Used for the fallback mark, so a broken tile matches the page's style. */
  emoji: string;
  sizes: string;
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
        <Image
          src={photo.url}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes={sizes}
          // A blank space where a photo should be reads as a loading state and
          // then never resolves, which is worse than an explicit fallback.
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}