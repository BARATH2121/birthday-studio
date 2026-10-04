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

function FileInput({ id, onAdd }: { id: string; onAdd: StepPhotosProps["onAdd"] }) {
  return (
    <input
      id={id}
      name={id}
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
  );
}

export default function StepPhotos({
  photos,
  error,
  onAdd,
  onRemove,
  onDismissError,
}: StepPhotosProps) {
  const inputId = FIELD_IDS.photos;
  const hasPhotos = photos.length > 0;

  return (
    <div className="grid gap-6">
      {hasPhotos ? (
        <label
          htmlFor={inputId}
          className="group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-white/14 bg-night-900/50 px-5 py-4 transition-colors duration-200 hover:border-blush-400/50 hover:bg-night-800/55 focus-within:border-blush-400/50 focus-within:ring-4 focus-within:ring-blush-400/15"
        >
          <FileInput id={inputId} onAdd={onAdd} />
          <span className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/6 text-blush-300 transition-colors duration-200 group-hover:border-blush-400/40">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="size-4"
                focusable="false"
                aria-hidden="true"
              >
                <path d="M10 4v12M4 10h12" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white/90">
                Add more photos
              </span>
              <span className="mt-0.5 block truncate text-xs text-white/50">
                JPG, PNG or WEBP · max {PHOTO_MAX_COUNT}
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium tabular-nums text-white/70">
            {photos.length}/{PHOTO_MAX_COUNT}
          </span>
        </label>
      ) : (
        <label
          htmlFor={inputId}
          className="group relative block cursor-pointer overflow-hidden rounded-[1.75rem] border border-dashed border-white/16 bg-night-900/40 p-10 text-center transition-colors duration-200 hover:border-blush-400/60 hover:bg-night-800/55 focus-within:border-blush-400/60 focus-within:ring-4 focus-within:ring-blush-400/15 sm:p-14"
        >
          <span
            aria-hidden="true"
            className="bs-dropzone-glow pointer-events-none absolute inset-0"
          />
          <span
            aria-hidden="true"
            className="bs-dropzone-sheen pointer-events-none absolute inset-0"
          />
          <FileInput id={inputId} onAdd={onAdd} />
          <span className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-white/12 bg-gradient-to-br from-blush-500/20 via-grape-500/15 to-azure-500/20 text-blush-200 shadow-[0_14px_30px_-16px_rgb(255_77_151/0.7)] transition-colors duration-200 group-hover:text-blush-100">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="currentColor"
              focusable="false"
              aria-hidden="true"
            >
              <path d="M12 3.5 13.9 10.1 20.5 12 13.9 13.9 12 20.5 10.1 13.9 3.5 12 10.1 10.1Z" />
            </svg>
          </span>
          <span className="relative mt-5 block text-lg font-semibold text-white">
            Add your photos
          </span>
          <span className="relative mt-2 block text-sm leading-6 text-white/55">
            Drop photos here or choose files
          </span>
          <span className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/80 shadow-[0_10px_24px_-14px_rgb(0_0_0/0.9)] transition-colors duration-200 group-hover:border-blush-400/40 group-hover:text-white">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              focusable="false"
              aria-hidden="true"
            >
              <path d="M6 6.75h1.5l.8-1.2a1 1 0 0 1 .84-.47h1.72a1 1 0 0 1 .84.47l.8 1.2H14A1.75 1.75 0 0 1 15.75 9v4.25A1.75 1.75 0 0 1 14 15H6a1.75 1.75 0 0 1-1.75-1.75V9A1.75 1.75 0 0 1 6 6.75Z" />
              <circle cx="10" cy="10.75" r="2" />
            </svg>
            Choose Photos
          </span>
          <span className="relative mt-6 block text-xs tracking-wide text-white/45">
            JPG, PNG or WEBP · up to {PHOTO_SIZE_LABEL} each · max{" "}
            {PHOTO_MAX_COUNT}
          </span>
        </label>
      )}

      <p
        className="flex items-center justify-center gap-2 text-xs text-white/45"
        aria-live="polite"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-grape-400" />
        <PhotoCount count={photos.length} />
      </p>

      {error ? (
        <p className="bs-error" role="alert">
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

      {hasPhotos ? (
        <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <div className="bs-photo-tile relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-night-800/85">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="block h-auto w-full" />
              </div>
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                aria-label={`Remove ${photo.name}`}
                className="absolute -right-2 -top-2 z-10 grid size-8 place-items-center rounded-full border border-white/20 bg-night-950/95 text-white/90 shadow-[0_10px_24px_-10px_rgb(0_0_0/0.95)] backdrop-blur transition-colors duration-200 hover:border-blush-400/70 hover:text-blush-200"
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