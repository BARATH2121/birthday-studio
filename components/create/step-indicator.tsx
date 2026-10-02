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
      <ol className="relative grid grid-cols-4 gap-2">
        <span
          aria-hidden="true"
          className="absolute left-[12.5%] right-[12.5%] top-5 h-px bg-white/10"
        />

        {CREATE_STEPS.map((step) => {
          const isCurrent = step.id === current;
          const isDone = step.id < current;

          return (
            <li key={step.id} className="flex flex-col items-center gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "relative z-10 grid size-10 shrink-0 place-items-center rounded-full",
                  "text-[0.8125rem] font-semibold transition-colors duration-200",
                  isCurrent
                    ? "text-white shadow-[0_10px_26px_-12px_rgb(168_85_247/0.95)] [background-image:linear-gradient(140deg,var(--color-blush-500)_0%,var(--color-grape-500)_52%,var(--color-azure-500)_100%)]"
                    : isDone
                      ? "border border-white/18 bg-white/10 text-white"
                      : "border border-white/10 bg-night-900/80 text-white/40",
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
                className={`text-[0.6875rem] leading-4 ${
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
