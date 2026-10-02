import {
  AUDIO_ACCEPT,
  AUDIO_SIZE_LABEL,
  FIELD_IDS,
  type AudioItem,
} from "@/lib/birthday";

type StepAudioProps = {
  audio: AudioItem | null;
  error: string | null;
  onSelect: (file: File | null) => void;
  onDismissError: () => void;
};

const FORMATS: readonly { label: string; title: string }[] = [
  { label: "MP3", title: "MP3 audio" },
  { label: "M4A", title: "MPEG-4 audio" },
  { label: "OGG", title: "Ogg audio" },
];

/**
 * Optional single track.
 *
 * Deliberately a smaller, quieter block than the photo picker. Audio is a
 * garnish, not the point of the page, and giving it the same visual weight as
 * the photos would push the thing people actually came to do down the page.
 * Nothing here is required, so there is no error state that blocks progress —
 * only one that explains why a chosen file was refused.
 */
export default function StepAudio({
  audio,
  error,
  onSelect,
  onDismissError,
}: StepAudioProps) {
  const inputId = FIELD_IDS.audio;

  const note = (format: (typeof FORMATS)[number]) => (
    <span
      key={format.label}
      title={format.title}
      className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[0.6875rem] text-white/55"
    >
      {format.label}
    </span>
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="bs-label mb-0">Add a song (optional)</p>
        <p className="text-xs text-white/45">
          Plays automatically when they open the page
        </p>
      </div>

      {audio ? (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/12 bg-night-900/50 p-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/6 text-blush-300"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              focusable="false"
            >
              <path d="M9 18V6l10-2v12" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="16" r="2.5" />
            </svg>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-white/85">
              {audio.name}
            </span>
            <span className="block text-xs text-white/45">
              {(audio.size / (1024 * 1024)).toFixed(1)} MB
            </span>
          </span>

          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white/60 underline underline-offset-2 transition-colors hover:text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="group mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-white/16 bg-night-900/50 px-4 py-3.5 transition-colors duration-200 hover:border-blush-400/50 hover:bg-night-800/60"
        >
          <input
            id={inputId}
            name={inputId}
            type="file"
            accept={AUDIO_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              onSelect(file ?? null);
              // Cleared so re-picking the same file fires `change` again.
              // Without this, choosing a track and removing it leaves the input
              // holding that filename, and the browser silently refuses to
              // re-fire for the identical file.
              event.target.value = "";
            }}
          />

          <span className="min-w-0">
            <span className="block text-sm text-white/80">
              Choose an audio file
            </span>
            <span className="mt-0.5 block text-xs text-white/45">
              From this device · up to {AUDIO_SIZE_LABEL}
            </span>
          </span>

          <span className="flex shrink-0 gap-1.5">
            {FORMATS.map(note)}
          </span>
        </label>
      )}

      {/* Only shown once something has been attached and refused, so an
          untouched optional field is never decorated with a warning. */}
      {error ? (
        <p className="bs-error mt-2" role="alert">
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
  );
}