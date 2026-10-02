import SectionShell from "./section-shell";
import { STEPS } from "@/lib/site-content";

export default function HowItWorks() {
  return (
    <SectionShell
      id="how-it-works"
      eyebrow="How it works"
      title="Three steps to their best birthday yet."
      description="No design skills, no editing software. Just a few honest details and a little care."
      className="pb-24 sm:pb-32"
    >
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="bs-card bs-hairline-top flex flex-col gap-5 p-6 transition-colors duration-200 hover:border-white/16 sm:p-7"
          >
            <span aria-hidden="true" className="bs-step-number w-fit">
              {step.number}
            </span>

            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {step.description}
              </p>
            </div>

            {step.vibes ? (
              <ul className="mt-auto flex flex-wrap gap-2 pt-2">
                {step.vibes.map((vibe) => (
                  <li key={vibe} className="bs-chip">
                    {vibe}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
