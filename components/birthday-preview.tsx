import CakeIllustration from "./cake-illustration";

const CONTENT_SLOTS = [
  { label: "Photos", accent: "bg-blush-400" },
  { label: "Memories", accent: "bg-grape-400" },
  { label: "Music", accent: "bg-azure-400" },
] as const;

export default function BirthdayPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-x-4 -inset-y-10 -z-10 rounded-full bg-grape-500/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-8 bottom-4 -z-10 h-40 -rotate-3 rounded-[2rem] border border-white/10 bg-night-800/70"
      />

      <div className="bs-card bs-sheen bs-hairline-top relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/8 text-white/70"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-5"
              focusable="false"
            >
              <path
                d="M4.6 11.2h14.8v7.6a1.6 1.6 0 0 1-1.6 1.6H6.2a1.6 1.6 0 0 1-1.6-1.6v-7.6Z"
                fill="currentColor"
                opacity="0.9"
              />
              <rect
                x="3.1"
                y="7.6"
                width="17.8"
                height="3.4"
                rx="1.1"
                fill="currentColor"
                opacity="0.75"
              />
              <rect
                x="10.8"
                y="11.2"
                width="2.4"
                height="9.2"
                fill="#ffffff"
                opacity="0.35"
              />
              <rect
                x="3.1"
                y="8.75"
                width="17.8"
                height="1.1"
                fill="#ffffff"
                opacity="0.35"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.95rem] font-semibold text-white">
              Your Birthday Preview
            </p>
            <p className="truncate text-xs text-white/50">Nothing added yet</p>
          </div>
          <span className="bs-chip ml-auto shrink-0">No style yet</span>
        </div>

        <div className="mt-4">
          <CakeIllustration />
        </div>

        <div>
          <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Your birthday surprise will appear here
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Add their name, message and memories to see your preview.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
          {CONTENT_SLOTS.map((slot) => (
            <span key={slot.label} className="bs-chip">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${slot.accent}`}
              />
              {slot.label}
            </span>
          ))}
          <span className="bs-chip ml-auto shrink-0">Not created yet</span>
        </div>
      </div>
    </div>
  );
}
