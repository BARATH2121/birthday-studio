import Link from "next/link";
import BrandLink from "./brand-link";
import CreateCta from "./create-cta";
import MobileNav from "./mobile-nav";
import { NAV_ITEMS } from "@/lib/site-content";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night-950/70 backdrop-blur-xl">
      <div className="bs-shell flex h-16 items-center justify-between gap-3 sm:h-18">
        <BrandLink />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/6 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <CreateCta className="px-5 py-2.5 text-sm" />
        </div>

        <div className="md:hidden">
          <MobileNav items={NAV_ITEMS} />
        </div>
      </div>
    </header>
  );
}
