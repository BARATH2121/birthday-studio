import Link from "next/link";

/**
 * Shown for a birthday link that does not resolve.
 *
 * The copy is deliberately neutral. It does not distinguish "this page never
 * existed" from "this page cannot be found right now", because the difference
 * is not something an anonymous visitor can be told, and guessing at it would
 * invite enumeration of valid ids.
 */
export default function BirthdayNotFound() {
  return (
    <main id="main" className="bs-shell flex flex-1 items-center justify-center py-10 sm:py-14">
        <section className="bs-card w-full max-w-md rounded-[1.75rem] p-6 text-center sm:p-8">
          <p className="bs-eyebrow justify-center">Not found</p>

          <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
            This birthday page isn&apos;t here
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
            The link may be incomplete, or the page may have been created in a
            different version of the app. If someone sent you a link, ask them to
            send it again — links are easy to lose a character from.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/create" className="bs-btn bs-btn-primary sm:w-auto">
              Create your own
            </Link>
            <Link href="/" className="bs-btn bs-btn-ghost sm:w-auto">
              Back to start
            </Link>
          </div>
        </section>
    </main>
  );
}
