import {
  BIRTHDAY_STYLES,
  FIELD_IDS,
  styleFieldId,
  type BirthdayStyleId,
} from "@/lib/birthday";

type StepStyleProps = {
  value: BirthdayStyleId | "";
  error?: string;
  onChange: (value: BirthdayStyleId) => void;
  onBlur: () => void;
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      focusable="false"
      aria-hidden="true"
    >
      <path d="m5 10.5 3.4 3.4L15 7" />
    </svg>
  );
}

export default function StepStyle({
  value,
  error,
  onChange,
  onBlur,
}: StepStyleProps) {
  return (
    <div>
      <fieldset
        aria-describedby={error ? `${FIELD_IDS.style}-error` : undefined}
      >
        <legend className="sr-only">
          Choose a style for the birthday page
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          {BIRTHDAY_STYLES.map((style) => {
            const selected = value === style.id;

            return (
              <label
                key={style.id}
                className="group relative block cursor-pointer"
              >
                <input
                  id={styleFieldId(style.id)}
                  type="radio"
                  name="birthday-style"
                  value={style.id}
                  checked={selected}
                  onChange={() => onChange(style.id)}
                  onBlur={onBlur}
                  className="peer sr-only"
                />

                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 z-10 hidden size-7 place-items-center rounded-full border border-white/30 bg-night-900/90 text-white shadow-[0_6px_18px_-8px_rgb(0_0_0/0.9)] peer-checked:grid"
                >
                  <CheckIcon />
                </span>

                <span className="block overflow-hidden rounded-2xl border border-white/10 bg-night-800/60 transition-colors duration-200 group-hover:border-white/22 peer-checked:border-blush-400/70 peer-checked:bg-blush-500/10 peer-focus-visible:border-blush-400/70">
                  <span
                    className="relative flex h-20 items-end p-3"
                    style={{ backgroundImage: style.gradient }}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-9 place-items-center rounded-full border border-white/25 bg-night-950/35 text-lg backdrop-blur-sm"
                    >
                      {style.emoji}
                    </span>
                  </span>

                  <span className="block px-3.5 py-3.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[0.95rem] font-semibold tracking-tight text-white">
                        {style.name}
                      </span>
                      {selected ? (
                        <span className="rounded-full border border-blush-400/45 bg-blush-500/15 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-blush-200">
                          Selected
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">
                      {style.tagline}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p
          className="bs-error mt-4"
          id={`${FIELD_IDS.style}-error`}
          role="alert"
        >
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
        </p>
      ) : null}
    </div>
  );
}
