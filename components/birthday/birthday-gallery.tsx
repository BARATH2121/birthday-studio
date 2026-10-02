import type { PhotoItem } from "@/lib/birthday";
import BirthdayPhotoFallback from "./birthday-photo-fallback";
import BirthdayPhotoFrame from "./birthday-photo-frame";

/**
 * How wide one tile can be, for the browser's own image loading decisions.
 *
 * The gallery is 2 columns below 40rem and 3 above, inside a max-2xl shell, with
 * the lead tile spanning two columns in several counts. Approximating the widest
 * a tile gets is enough here; `sizes` only needs to be in the right order of
 * magnitude for the browser to pick a candidate rather than always fetch the
 * largest.
 */
const TILE_SIZES = "(min-width: 640px) 22rem, 45vw";

export default function BirthdayGallery({
  photos,
  emoji,
}: {
  photos: PhotoItem[];
  emoji: string;
}) {
  if (photos.length === 0) {
    return (
      <div className="bp-reveal bp-d3">
        <BirthdayPhotoFallback
          emoji={emoji}
          message="No photos were added for this birthday page."
        />
      </div>
    );
  }

  return (
    // `data-count` is the whole layout mechanism: the aspect ratios and the lead
    // tile's column span are selected from it in CSS. Changing the number of
    // photos is therefore the only thing that has to change for the grid to
    // rearrange itself, with no per-index logic here.
    <div className="bp-gallery bp-reveal bp-d3" data-count={photos.length}>
      {photos.map((photo, index) => (
        <BirthdayPhotoFrame
          key={photo.id}
          photo={photo}
          alt={`Photo ${index + 1} of ${photos.length}`}
          emoji={emoji}
          sizes={TILE_SIZES}
          // Only the first tile, and only because it is above the fold. Marking
          // every tile priority would ask the browser to fetch all twenty at once
          // and defeat the lazy loading the rest rely on.
          priority={index === 0}
        />
      ))}
    </div>
  );
}