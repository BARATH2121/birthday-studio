import Image from "next/image";
import {
  FIELD_IDS,
  PHOTO_ACCEPT,
  PHOTO_MAX_COUNT,
  PHOTO_SIZE_LABEL,
  type PhotoItem,
} from "@/lib/birthday";

type StepPhotosProps = {
  photos: PhotoItem[];
  error: string | null;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onDismissError: () => void;
};

function PhotoCount({ count }: { count: number }) {
  if (count === 0) return <>No photos selected</>;
  if (count === 1) return <>1 photo selected</>;
  return <>{count} photos selected</>;
}

export default function StepPhotos({
  photos,
  error,
  onAdd,
  onRemove,
  onDismissError,
}: StepPhotosProps) {
  const inputId = FIELD_IDS.photos;

  return (
    <div className="grid gap-6">
      <div>
        <label
          htmlFor={inputId}
          className="group block cursor-pointer rounded-2xl border border-dashed border-white/16 bg-night-900/50 p-6 text-center transition-colors duration-200 hover:border-blush-400/60 hover:bg-night-800/60 sm:p-8"
        >
          <input
            id={inputId}
            name={inputId}
            type="file"
            multiple
            accept={PHOTO_ACCEPT}
            className="peer sr-only"
            onChange={(event) => {
              onAdd(event.target.files);
              event.target.value = "";
            }}
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
          />

          <span className="mx-auto grid size-12 place-items-center rounded-full border border-white/12 bg-white/6 text-blush-300 transition-colors duration-200 group-hover:border-blush-400/50">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              focusable="false"
              aria-hidden="true"
            >
              <path d="M12 16V4m0 0L8 8m4-4 4 4" />
              <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
            </svg>
          </span>

          <span className="mt-4 block text-[0.95rem] font-semibold text-white">
            Add photos
          </span>
          <span className="mt-1.5 block text-sm leading-6 text-white/55">
            Choose images from this device
          </span>
          <span className="mt-3 inline-flex rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-white/55">
            JPG, PNG or WEBP · up to {PHOTO_SIZE_LABEL} each · max{" "}
            {PHOTO_MAX_COUNT}
          </span>
        </label>

        <p
          className="mt-3 flex items-center justify-center gap-2 text-xs text-white/45"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-grape-400"
          />
          <PhotoCount count={photos.length} />
        </p>

        {error ? (
          <p className="bs-error mt-3" role="alert">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              className="mt-px size-3.5 shrink-0"
              focusable="false"
            >
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 6.2v4.4M10 13.6h.01" />
            </svg>
            <span>{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="ml-auto shrink-0 rounded-md text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-white/60 underline underline-offset-2 hover:text-white"
            >
              Dismiss
            </button>
          </p>
        ) : null}
      </div>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-night-800">
                <Image
                  src={photo.url}
                  alt={photo.name}
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 160px, 33vw"
                  className="object-cover"
                />
              </div>

              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                aria-label={`Remove ${photo.name}`}
                className="absolute -right-1.5 -top-1.5 grid size-7 place-items-center rounded-full border border-white/20 bg-night-900/95 text-white shadow-[0_6px_16px_-8px_rgb(0_0_0/0.9)] transition-colors duration-200 hover:border-blush-400/70 hover:text-blush-200"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  className="size-3.5"
                  focusable="false"
                  aria-hidden="true"
                >
                  <path d="m6 6 8 8M14 6l-8 8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
