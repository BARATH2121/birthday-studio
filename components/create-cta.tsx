"use client";

import { usePathname } from "next/navigation";
import ActionLink from "./action-link";

type CreateCtaProps = {
  className?: string;
  short?: boolean;
};

/**
 * The "Create Birthday" call-to-action shown in the site header.
 *
 * Hidden while already on /create: once someone is building a page, the CTA
 * has nothing left to offer, and a second primary button on the page would
 * compete with the create flow's own navigation.
 */
export default function CreateCta({ className, short }: CreateCtaProps) {
  const pathname = usePathname();
  if (pathname && pathname.startsWith("/create")) return null;
  return (
    <ActionLink href="/create" className={className}>
      {short ? "Create" : "Create Birthday"}
    </ActionLink>
  );
}