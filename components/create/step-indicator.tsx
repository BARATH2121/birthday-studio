import { CREATE_STEPS } from "@/lib/birthday";

type StepIndicatorProps = {
  current: number;
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
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

export default function StepIndicator({ current }: StepIndicatorProps) {
  const total = CREATE_STEPS.length;

  return (
    <nav aria-label="Birthday creation progress">
      <ol className="relative grid grid-cols-4 gap-1 sm:gap-2">
        <span
          aria-hidden="true"
          className="absolute left-[12.5%] right-[12.5%] top-[18px] h-px bg-white/10 sm:top-5"
        />
        <span
          aria-hidden="true"
          className="absolute left-[12.5%] top-[18px] h-px bg-linear-to-r from-emerald-400/70 to-emerald-400/40 transition-[width] duration-500 sm:top-5"
          style={{
            width: `calc((100% - 25%) * ${Math.min(Math.max((current - 1) / (total - 1), 0), 1)})`,
          }}
        />

        {CREATE_STEPS.map((step) => {
          const isCurrent = step.id === current;
          const isDone = step.id < current;

          return (
            <li key={step.id} className="flex flex-col items-center gap-1.5 sm:gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "relative z-10 grid place-items-center rounded-full",
                  "text-[0.8125rem] font-semibold transition-all duration-300",
                  isCurrent
                    ? "step-current size-10 text-white shadow-[0_10px_30px_-8px_rgb(168_85_247/0.9)] ring-2 ring-white/25 [background-image:linear-gradient(140deg,var(--color-blush-500)_0%,var(--color-grape-500)_52%,var(--color-azure-500)_100%)] sm:size-11"
                    : isDone
                      ? "size-10 border border-emerald-400/40 bg-night-900/90 text-emerald-100 shadow-[0_0_20px_-6px_rgb(52_211_153/0.65)] sm:size-10"
                      : "size-10 border border-white/12 bg-night-900/70 text-white/45 sm:size-10",
                ].join(" ")}
              >
                <span aria-hidden="true">
                  {isDone ? <CheckIcon /> : step.id}
                </span>
                <span className="sr-only">
                  {`Step ${step.id} of ${total}: ${step.name}${
                    isCurrent ? ", current step" : isDone ? ", completed" : ""
                  }`}
                </span>
              </span>

              <span
                className={`text-[0.625rem] font-medium leading-4 sm:text-[0.6875rem] ${
                  isCurrent ? "text-white" : "text-white/45"
                }`}
              >
                {step.name}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
