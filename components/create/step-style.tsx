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
                data-bstyle={style.id}
                className={`bs-style-card relative block cursor-pointer ${
                  style.id === "cinematic" ? "sm:col-span-2" : ""
                }`}
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

                <span aria-hidden="true" className="bs-style-check">
                  <CheckIcon />
                </span>

                <span className="bs-style-surface">
                  <span aria-hidden="true" className="bs-style-aura" />
                  <span className="bs-style-icon">
                    <span className="bs-style-emoji">{style.emoji}</span>
                  </span>
                  <span className="bs-style-title">{style.name}</span>
                  <span className="bs-style-desc">{style.description}</span>
                  {selected ? (
                    <span className="bs-style-chip">Selected</span>
                  ) : null}
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
