"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for the public birthday route.
 *
 * Next.js only renders the digest in production, and even then it is an
 * internal identifier. The visitor gets a human sentence; the developer gets
 * one structured log line.
 */
export default function BirthdayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[birthday] route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main id="main" className="bs-shell flex flex-1 items-center justify-center py-10 sm:py-14">
      <section className="bs-card w-full max-w-md rounded-[1.75rem] p-6 text-center sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          This page didn&apos;t load
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Something interrupted loading the birthday page. Trying again often
          helps — it may be a brief connection problem.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="bs-btn bs-btn-primary sm:w-auto">
            Try again
          </button>
          <Link href="/create" className="bs-btn bs-btn-ghost sm:w-auto">
            Create your own
          </Link>
        </div>
      </section>
    </main>
  );
}
