import type { ReactNode } from "react";

type SectionShellProps = {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SectionShell({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: SectionShellProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={className}
    >
      <div className="bs-shell">
        <div className="max-w-2xl">
          <p className="bs-eyebrow">{eyebrow}</p>
          <h2
            id={`${id}-heading`}
            className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-4 text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}
