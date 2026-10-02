import Link from "next/link";

export default function BrandLink() {
  return (
    <Link
      href="/"
      aria-label="Birthday Studio, go to home"
      className="inline-flex items-center gap-2.5 rounded-xl"
    >
      <span aria-hidden="true" className="bs-logo-tile size-9 shrink-0">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
          focusable="false"
        >
          <path
            d="M4.6 11.2h14.8v7.6a1.6 1.6 0 0 1-1.6 1.6H6.2a1.6 1.6 0 0 1-1.6-1.6v-7.6Z"
            fill="currentColor"
            opacity="0.95"
          />
          <rect x="3.1" y="7.6" width="17.8" height="3.4" rx="1.1" fill="currentColor" />
          <rect x="10.8" y="11.2" width="2.4" height="9.2" fill="#ffffff" opacity="0.45" />
          <rect x="3.1" y="8.75" width="17.8" height="1.1" fill="#ffffff" opacity="0.45" />
          <path
            d="M12 7.6c-2.6-.9-3.9-2-3.9-3.2 0-.8.6-1.4 1.4-1.4 1.3 0 2.2 1.6 2.5 4.6Zm0 0c2.6-.9 3.9-2 3.9-3.2 0-.8-.6-1.4-1.4-1.4-1.3 0-2.2 1.6-2.5 4.6Z"
            fill="currentColor"
            opacity="0.95"
          />
        </svg>
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight text-white">
        Birthday{" "}
        <span className="text-white/55">Studio</span>
      </span>
    </Link>
  );
}
