import type { PhotoItem } from "@/lib/birthday";
import BirthdayPhotoFallback from "./birthday-photo-fallback";
import BirthdayPhotoFrame from "./birthday-photo-frame";

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
    // `data-count` drives the grid: the lead tile's column span is selected from
    // it in CSS. Changing the number of photos is therefore the only thing that
    // has to change for the grid to rearrange itself, with no per-index logic
    // here.
    <div className="bp-gallery bp-reveal bp-d3" data-count={photos.length}>
      {photos.map((photo, index) => (
        <BirthdayPhotoFrame
          key={photo.id}
          photo={photo}
          alt={`Photo ${index + 1} of ${photos.length}`}
          emoji={emoji}
          // Only the first tile, and only because it is above the fold. Marking
          // every tile priority would ask the browser to fetch all twenty at once
          // and defeat the lazy loading the rest rely on.
          priority={index === 0}
        />
      ))}
    </div>
  );
}