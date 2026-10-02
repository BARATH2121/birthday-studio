import type { Metadata } from "next";
import Link from "next/link";
import BrandLink from "@/components/brand-link";
import CreateFlow from "@/components/create/create-flow";

export const metadata: Metadata = {
  title: "Create a Birthday — Birthday Studio",
  description:
    "Add their details, photos and style to build a personalized birthday surprise.",
};

export default function CreatePage() {
  return (
    <>
      <header className="border-b border-white/10">
        <div className="bs-shell flex h-16 items-center justify-between gap-4 sm:h-18">
          <BrandLink />
          <Link
            href="/"
            className="bs-btn bs-btn-ghost px-4 py-2 text-xs sm:text-sm"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex flex-col">
        <CreateFlow />
      </main>
    </>
  );
}
