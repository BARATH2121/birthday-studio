import ActionLink from "./action-link";
import BirthdayPreview from "./birthday-preview";
import { HERO_HIGHLIGHTS } from "@/lib/site-content";

export default function Hero() {
  return (
    <section id="top" className="relative">
      <div className="bs-shell grid grid-cols-[minmax(0,1fr)] items-center gap-14 pb-20 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="max-w-xl">
          <p className="bs-eyebrow">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-blush-400 shadow-[0_0_10px_2px_rgb(255_77_151/0.7)]"
            />
            Personalized birthday surprises
          </p>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Make their birthday{" "}
            <span className="bs-text-gradient">feel unforgettable.</span>
          </h1>

          <p className="mt-6 text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
            Birthday Studio turns a simple birthday wish into a personalized web
            experience. Add their name, your words and the memories that matter
            — then send them a beautiful page they can open anywhere.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ActionLink
              href="/create"
              className="w-full px-6 py-3.5 text-[0.95rem] sm:w-auto"
            >
              Create a Birthday Surprise
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-4"
                focusable="false"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </ActionLink>
            <ActionLink
              href="#how-it-works"
              variant="ghost"
              className="w-full px-6 py-3.5 text-[0.95rem] sm:w-auto"
            >
              See how it works
            </ActionLink>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {HERO_HIGHLIGHTS.map((highlight) => (
              <li
                key={highlight}
                className="flex items-center gap-2 text-sm text-white/55"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-4 shrink-0 text-grape-300"
                  focusable="false"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <div id="preview">
          <BirthdayPreview />
        </div>
      </div>
    </section>
  );
}
