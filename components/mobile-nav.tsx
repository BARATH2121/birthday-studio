"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import ActionLink from "./action-link";
import type { NavItem } from "@/lib/site-content";

type MobileNavProps = {
  items: readonly NavItem[];
  ctaLabel: string;
  ctaLabelShort: string;
};

export default function MobileNav({
  items,
  ctaLabel,
  ctaLabelShort,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <ActionLink href="/create" className="px-4 py-2.5 text-sm">
        <span className="sm:hidden">{ctaLabelShort}</span>
        <span className="hidden sm:inline">{ctaLabel}</span>
      </ActionLink>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          className="size-5"
          focusable="false"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-white/10 bg-night-950/95 backdrop-blur-xl"
      >
        <nav aria-label="Mobile" className="bs-shell flex flex-col gap-1 py-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-[0.95rem] font-medium text-white/80 transition-colors hover:bg-white/6 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <ActionLink href="/create" className="mt-2 w-full">
            {ctaLabel}
          </ActionLink>
        </nav>
      </div>
    </div>
  );
}
