"use client";

import {
  BIRTHDAY_STYLES,
  FIELD_IDS,
  styleFieldId,
  type BirthdayStyleId,
} from "@/lib/birthday";
import BirthdayScene from "@/components/birthday/birthday-scene";
import { themeFor } from "@/components/birthday/style-theme";

type StepStyleProps = {
  value: BirthdayStyleId | "";
  error?: string;
  onChange: (value: BirthdayStyleId) => void;
  onBlur: () => void;
};

type Style = (typeof BIRTHDAY_STYLES)[number];

const HERO_GLOWS: Record<BirthdayStyleId, string> = {
  romantic: "rgb(255 77 151 / 0.2)",
  "cute-colorful": "rgb(255 210 63 / 0.16)",
  elegant: "rgb(232 207 154 / 0.14)",
  "fun-crazy": "rgb(255 122 61 / 0.18)",
  cinematic: "rgb(147 180 255 / 0.2)",
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

function SelectedPill() {
  return (
    <span className="rounded-full border border-blush-400/45 bg-blush-500/15 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-blush-200">
      Selected
    </span>
  );
}

function HeroOption({
  style,
  selected,
  onChange,
  onBlur,
}: {
  style: Style;
  selected: boolean;
  onChange: (value: BirthdayStyleId) => void;
  onBlur: () => void;
}) {
  const theme = themeFor(style.id);

  return (
    <label className="group relative block cursor-pointer">
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
        className="absolute right-2 top-2 z-20 hidden size-7 place-items-center rounded-full border border-white/30 bg-night-900/90 text-white shadow-[0_6px_18px_-8px_rgb(0_0_0/0.9)] peer-checked:grid"
      >
        <CheckIcon />
      </span>

      <span className="block overflow-hidden rounded-[1.25rem] border border-white/10 bg-night-900/70 transition-colors duration-200 group-hover:border-white/22 peer-checked:border-blush-400/70 peer-checked:bg-blush-500/10 peer-focus-visible:border-blush-400/70">
        <span className="bs-pick-stage block aspect-[16/10] min-h-[11rem] sm:aspect-[21/10]">
          <span
            className={`bs-style-art bs-style-art--${style.id} absolute inset-0`}
            aria-hidden="true"
          />
          <BirthdayScene key={style.id} scene={theme.scene} />

          <span
            aria-hidden="true"
            className="absolute left-4 top-4 z-[3] grid size-10 place-items-center rounded-full border border-white/25 bg-night-950/40 text-lg backdrop-blur-md"
          >
            {style.emoji}
          </span>

          <span className="absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between gap-3 p-5">
            <span>
              <span className="block text-lg font-semibold tracking-tight text-white sm:text-xl">
                Happy Birthday
              </span>
              <span className="mt-0.5 block text-xs text-white/70">
                {style.name} · live in your card
              </span>
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/20 bg-night-950/60 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-white/75 backdrop-blur-sm sm:flex">
              <span className="size-1.5 rounded-full bg-blush-300 shadow-[0_0_8px_rgb(255_163_201/0.9)]" />
              Live scene
            </span>
          </span>
        </span>

        <span className="block px-4 py-3.5 sm:px-5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-semibold tracking-tight text-white">
              {style.name}
            </span>
            {selected ? <SelectedPill /> : null}
          </span>
          <span className="mt-1 block text-xs leading-5 text-white/55">
            {style.tagline}
          </span>
        </span>
      </span>
    </label>
  );
}

function MiniOption({
  style,
  selected,
  onChange,
  onBlur,
}: {
  style: Style;
  selected: boolean;
  onChange: (value: BirthdayStyleId) => void;
  onBlur: () => void;
}) {
  return (
    <label className="group relative block cursor-pointer">
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
        className="absolute right-2 top-2 z-10 hidden size-6 place-items-center rounded-full border border-white/30 bg-night-900/90 text-white shadow-[0_6px_18px_-8px_rgb(0_0_0/0.9)] peer-checked:grid"
      >
        <CheckIcon />
      </span>

      <span className="block overflow-hidden rounded-2xl border border-white/10 bg-night-800/60 transition-colors duration-200 group-hover:border-white/22 peer-checked:border-blush-400/70 peer-checked:bg-blush-500/10 peer-focus-visible:border-blush-400/70">
        <span
          className={`bs-style-art bs-style-art--${style.id} relative flex h-16 items-end p-2.5`}
        >
          <span
            aria-hidden="true"
            className="absolute left-2.5 top-2.5 grid size-8 place-items-center rounded-full border border-white/25 bg-night-950/35 text-base backdrop-blur-sm"
          >
            {style.emoji}
          </span>
          <span className="relative z-[1] text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/90 drop-shadow">
            Happy Birthday
          </span>
        </span>

        <span className="block px-3.5 py-3">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[0.93rem] font-semibold tracking-tight text-white">
              {style.name}
            </span>
            {selected ? <SelectedPill /> : null}
          </span>
          <span className="mt-1 block text-xs leading-5 text-white/55">
            {style.tagline}
          </span>
        </span>
      </span>
    </label>
  );
}

export default function StepStyle({
  value,
  error,
  onChange,
  onBlur,
}: StepStyleProps) {
  const featured: Style =
    BIRTHDAY_STYLES.find((style) => style.id === value) ?? BIRTHDAY_STYLES[0];
  const rest = BIRTHDAY_STYLES.filter((style) => style.id !== featured.id);

  return (
    <div>
      <fieldset
        aria-describedby={error ? `${FIELD_IDS.style}-error` : undefined}
      >
        <legend className="sr-only">
          Choose a style for the birthday page
        </legend>

        <div
          className="bs-pick rounded-[1.5rem] p-4 sm:p-5"
          style={{ "--p-glow": HERO_GLOWS[featured.id] } as React.CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[0.655rem] font-semibold uppercase tracking-[0.22em] text-white/70">
              Birthday Wish
            </p>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {BIRTHDAY_STYLES.map((style) => (
                <span
                  key={style.id}
                  className="grid size-6 place-items-center rounded-full border border-white/15 bg-night-950/40 text-[0.65rem]"
                >
                  {style.emoji}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <HeroOption
              style={featured}
              selected={value === featured.id}
              onChange={onChange}
              onBlur={onBlur}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {rest.map((style) => (
                <MiniOption
                  key={style.id}
                  style={style}
                  selected={value === style.id}
                  onChange={onChange}
                  onBlur={onBlur}
                />
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {error ? (
        <p
          className="bs-error mt-5"
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