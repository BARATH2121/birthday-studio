import type { ChangeEvent, ReactNode } from "react";

type FieldShellProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /**
   * Keeps the `<label>` for assistive technology and error association, but out
   * of the visual layout. Used by the month/day pair, which sits under a single
   * group heading.
   */
  hideLabel?: boolean;
  children: (describedBy: string | undefined) => ReactNode;
};

function FieldShell({ id, label, error, hint, hideLabel, children }: FieldShellProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label className={hideLabel ? "sr-only" : "bs-label"} htmlFor={id}>
        {label}
      </label>

      <div className={hideLabel ? "" : "mt-2.5"}>{children(describedBy)}</div>

      {error ? (
        <p className="bs-error mt-2" id={errorId} role="alert">
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

      {hint ? (
        <p className="bs-hint mt-2" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type BaseFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  placeholder?: string;
};

type TextFieldProps = BaseFieldProps & {
  type?: "text";
  autoComplete?: string;
  inputMode?: "text" | "search";
};

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {(describedBy) => (
        <input
          id={id}
          name={id}
          type={type}
          className="bs-control"
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
          onBlur={onBlur}
        />
      )}
    </FieldShell>
  );
}

type SelectOption = string | { value: string; label: string };

type SelectFieldProps = BaseFieldProps & {
  /**
   * Plain strings render as both the value and the label. Objects are needed
   * when the stored value is not what the person reads — the month select holds
   * `10` but shows "October", and the birthday day select holds `29` but shows
   * "29".
   */
  options: readonly SelectOption[];
  placeholder?: string;
};

export function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  options,
  placeholder = "Choose a relationship",
  hideLabel,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} hideLabel={hideLabel}>
      {(describedBy) => (
        <div className="relative">
          <select
            id={id}
            name={id}
            className="bs-control appearance-none pr-11"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onChange(event.target.value)
            }
            onBlur={onBlur}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => {
              const optionValue = typeof option === "string" ? option : option.value;
              const optionLabel = typeof option === "string" ? option : option.label;
              return (
                <option key={optionValue} value={optionValue}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/50"
            focusable="false"
          >
            <path d="m5 8 5 5 5-5" />
          </svg>
        </div>
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = BaseFieldProps & {
  maxLength: number;
  counter: ReactNode;
};

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  maxLength,
  counter,
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {(describedBy) => (
        <div className="relative">
          <textarea
            id={id}
            name={id}
            rows={5}
            className="bs-control min-h-32 resize-y pb-10 sm:min-h-36"
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              onChange(event.target.value.slice(0, maxLength))
            }
            onBlur={onBlur}
          />
          <div className="pointer-events-none absolute bottom-3 right-3">
            {counter}
          </div>
        </div>
      )}
    </FieldShell>
  );
}
