import Link from "next/link";
import BrandLink from "./brand-link";
import { NAV_ITEMS } from "@/lib/site-content";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="bs-shell flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <BrandLink />

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="py-2 text-sm text-white/50 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/create"
            className="py-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            Create Birthday
          </Link>
        </nav>

        <p className="text-sm text-white/55">
          Made for the people you love.
        </p>
      </div>
    </footer>
  );
}
